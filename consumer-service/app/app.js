import requestPromise from 'request-promise';
import { app, errorHandler, query, update } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import * as mu from 'mu';
import * as seq from './sequence.js';
import * as tc from './tripleconversions.js';
import http from "http";

const INGEST_INTERVAL = process.env.INGEST_INTERVAL_MS || 5000;
const HISTORYGRAPH    = "http://mu.semte.ch/graphs/history";

//For retreiving
const TUNNEL_BASE            = process.env.TUNNEL_BASE          || 'tunnel';
const TUNNEL_PATH            = process.env.TUNNEL_PATH          || '/out';
const TUNNEL_DEST_IDENTITY   = process.env.TUNNEL_DEST_IDENTITY || 'producer@redpencil.io';
const DELTA_BASE_URL         = process.env.DELTA_BASE_URL       || 'http://producer';
const DELTA_ENDPOINT         = `${DELTA_BASE_URL}/deltas?sequence=:seq`;


async function triggerIngest() {
  console.log(`Consuming deltas at ${new Date().toISOString()}`);
  //requestPromise.post('http://localhost/ingest/');
  await ingestDeltas();
  setTimeout(triggerIngest, INGEST_INTERVAL);
}

//triggerIngest();

app.get('/ingest', async function(req, res, next) {
  let result = await ingestDeltas();
  res.status(200).json({ "result": result });
});

async function ingestDeltas() {
  //Get latest sequence number, probably from the store, or cached locally
  const sequence = await seq.getNext();

  //TODO create task and store
  
  //Retreive deltas since sequence
  const historyDeltas = await getDeltas(sequence);

  //No deltas means early stop
  if (historyDeltas.updates && historyDeltas.updates.length < 1) return { result: "Nothing to do" };
  
  //Save history in own store
  await storeHistoryFromDeltas(historyDeltas);
  
  //TODO update task status
  
  //Transform history into regular deltas (i.e. { deltas: [ { inserts: [], deletes: [] },  {...} ] })
  //Note the structure: we still need to keep track of bundles here
  const regularDeltas = tc.historyToRegular(historyDeltas);
  console.log("RegularDeltas:", JSON.stringify(regularDeltas));
  
  //TODO filter out file triples, depending on implementation further, they need not stored now
  
  //Save triples in own store
  await storeDeltas(regularDeltas);
  //return regularDeltas;
  
  //TODO retreive files and put to file service
  
  //TODO update task status and end sequence number
  
  //Important to invalidate the seq. Will need to be retreived from store on next round, or needs to be updated from the historyDeltas (rather complex and much work for little improvements).
  await seq.invalidate();
  return regularDeltas;
}

function getDeltas(startSequence) {
  return new Promise((resolve, reject) => {
  
    console.log("Retreiving deltas from producer");

    let deltas = [];

    let postData = JSON.stringify({
      peer:   TUNNEL_DEST_IDENTITY,
      method: "GET",
      url:    DELTA_ENDPOINT.replace(":seq", startSequence)
    });

    let options = {
      method:   "POST",
      hostname: TUNNEL_BASE,
      path:     TUNNEL_PATH,
      port:     80,
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    let req = http.request(options, (res) => {
      res.on("data", (chunck) => {
        deltas.push(chunck);
      });

      res.on("end", () => {
        //Data fully came through now
        deltas = JSON.parse(deltas.join(""));
        console.log("Deltas successfully retreived from producer");
        resolve(deltas);
      });
    });

    req.on("error", (err) => {
      console.error("Delta request failed:", err);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function storeHistoryFromDeltas(deltas) {
  console.log("Storing history from producer");
  if (deltas.updates.length < 1) return;
  let triples   = deltas.updates.map(tc.tripleToRDF);
  let slicesize = 100;

  let queryBody;
  for (let i = 0; i < triples.length;) {
    queryBody = `
      INSERT DATA {
        GRAPH ${mu.sparqlEscapeUri(HISTORYGRAPH)} {
          ${triples.slice(i, i + slicesize).join("\n")}
        }
      }
    `;
    await updateSudo(queryBody); //As mu-auth-sudo, no hindering and no deltas produced
    i += slicesize;
  }

  console.log("History from producer successfully stored");
}

async function storeDeltas(regularDeltas) {
  //Deltas in the form { deltas: [
  //                        {
  //                            inserts:
  //                                [ { subject: { value: "", type: "", datatype: "" }, predicate: {...}, object: {...} }, ... ],
  //                            deletes: []
  //                        },
  //                        {}, ...
  //                     ] }
  //Execute bundles in order!
  for (let bundle of regularDeltas.deltas) {
    //Execute these in this order!
    await storeInserts(bundle.inserts); //Not as mu-auth-sudo, auth will need to put in the correct graphs
    await storeDeletes(bundle.deletes); //%
  }
}

async function storeInserts(inserts) {
  //console.log("INSERTS:", JSON.stringify(inserts));
  if (inserts.length < 1) return;

  let triples   = inserts.map(tc.tripleToRDF);
  let slicesize = 100;
  
  let queryBody;
  for (let i = 0; i < triples.length;) {
    queryBody = `
      INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/public> {
          ${triples.slice(i, i + slicesize).join("\n")}
        }
      }
    `;
    await update(queryBody);
    i += slicesize;
  }
}

async function storeDeletes(deletes) {
  //console.log("DELETES:", JSON.stringify(deletes));
  if (deletes.length < 1) return;

  let triples   = deletes.map(tc.tripleToRDF);
  let slicesize = 100;
  let queryBody;

  for (let i = 0; i < triples.length;) {
    queryBody = `
      DELETE DATA {
        GRAPH <http://mu.semte.ch/graphs/public> {
          ${triples.slice(i, i += slicesize).join("\n")}
        }
      }
    `;
    await update(queryBody);
    i += slicesize;
  }
}

