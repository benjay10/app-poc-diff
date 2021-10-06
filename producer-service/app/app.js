// see https://github.com/mu-semtech/mu-javascript-template for more info
//import { app, errorHandler, uuid, sparqlEscapeDateTime } from 'mu';
import mu from "mu";
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import fs from 'fs-extra';
import bodyParser from 'body-parser';
import http from "http";

mu.app.use(bodyParser.json({ type: function(req) { return /^application\/json/.test(req.get('content-type')); } }));

const DELTA_INTERVAL  = process.env.DELTA_INTERVAL_MS || 1000;
const SHAREfOLDER     = '/share';
const FILEGRAPH       = "http://mu.semte.ch/graphs/sync";
//const SYNCFILESERVICE = "syncfile";
const HISTORYGRAPH    = "http://mu.semte.ch/graphs/history";

let cache      = [];
let hasTimeout = null;

mu.app.post('/delta', function(req, res) {
  const body = req.body;

  console.log(`Pushing onto cache ${JSON.stringify(body)}`);

  cache.push(...body);

  if(!hasTimeout) {
    triggerTimeout();
  }

  res.status(200).send("Processed");
});

mu.app.get('/deltas', async function(req, res) {
  const sequence = req.query.sequence;
  let deltas = await getDeltasSince(sequence);
  res.json(deltas);
});

mu.app.get('/syncfiles', async function(req, res) {
  const since = req.query.since || new Date().toISOString();
  console.log(`Retrieving delta files since ${since}`);

  const result = await query(`
    PREFIX mu:  <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?uuid ?filename ?created WHERE {
      ?s a nfo:FileDataObject ;
          mu:uuid ?uuid ;
          nfo:fileName ?filename ;
          dct:publisher <http://mu.semte.ch/services/poc-diff-producer-service> ;
          dct:created ?created .
      ?file nie:dataSource ?s .

      FILTER (?created > "${since}"^^xsd:dateTime)
    } ORDER BY ?created
  `);

  const files = result.results.bindings.map(b => {
    return {
      type: 'files',
      id: b['uuid'].value,
      attributes: {
        name: b['filename'].value,
        created: b['created'].value
      }
    };
  });

  res.json({ data: files });
});

function triggerTimeout() {
  setTimeout(executeDeltaUpdates, DELTA_INTERVAL);
  hasTimeout = true;
}

async function executeDeltaUpdates() {
  const data = cache;
  cache = [];

  console.log("These are the updates:", JSON.stringify(data));
  
  //Data is array of bundels of triples, keep them in bundles because that ordering is important for now

  data.map((bundle) => {
    //Find updates, rather than only deletes and inserts
    const filteredTriples = splitUpdatesApart(bundle);
    const updates = filteredTriples.updates;
    const inserts = filteredTriples.inserts;
    const deletes = filteredTriples.deletes;

    console.log("Split the data; inserts:", inserts);
    console.log("Split the data; updates:", updates);
    console.log("Split the data; deletes:", deletes);

    executeUpdates(inserts, "insert");
    executeUpdates(updates, "update");
    executeUpdates(deletes, "delete");
    hasTimeout = false;
  });
}

async function executeUpdates(triples, type) {
  if (triples.length == 0) return;
  let needsOldValue = (type === "update" || type === "delete");
  let needsNewValue = (type === "update" || type === "insert");
  await initSequenceNumber();
  let queryBodies = triples.map((triple) => {
    let seq = getNextSequenceNumber();
    let queryBody = `
          de:change${seq}
            a            de:History ;
            de:aboutURI  ${mu.sparqlEscapeUri(triple.subject.value)} ;
            de:aboutProp ${mu.sparqlEscapeUri(triple.predicate.value)} ;
            de:oldValue  ${needsOldValue ? sparqlEscapeGen(triple.object) : "de:nil"} ;
            de:newValue  ${needsNewValue ? sparqlEscapeGen(triple.object) : "de:nil"} ;
            de:sequence  ${mu.sparqlEscapeInt(seq)} ;
            de:timeStamp ${mu.sparqlEscapeDateTime(new Date())} .
    `;
    //console.log("Query to execute: ", queryBody);
    return queryBody;
  });

  let queryFull = `
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX de:  <http://mu.semte.ch/vocabularies/delta/>

    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(HISTORYGRAPH)} {
        ${queryBodies.join("\n")}
      }
    }
  `;
  console.log("Full query:", queryFull);
  await update(queryFull);
}

function splitUpdatesApart(bundle) {
  let tripleEquals = (t1, t2) => t1.subject.value === t2.subject.value && t1.predicate.value === t2.predicate.value;

  let inserts = bundle.inserts;
  let deletes = bundle.deletes;

  let updates = [];
  let newInserts = [];

  let foundOne = false;
  for (let i = 0; i < inserts.length; i++) {
    for (let j = 0; j < deletes.length; j++) {
      if (tripleEquals(inserts[i], deletes[j])) {
        update.push({ insert: insert[i], delete: deletes[j] });
        foundOne = j;
        break;
      }
    }
    if (foundOne) {
      deletes.splice(foundOne, 1);
    } else {
      newInserts.push(inserts[i]);
    }
    foundOne = false;
  }

  return { inserts: newInserts, updates: updates, deletes: deletes };
}

//async function generateDeltaFile() {
//  const cachedArray = cache;
//  cache = [];
//
//  hasTimeout = false;
//  
//  //////////////////////////////////////Upload to file service in the project
//
//  //Upload file directly to syncfile service
//
//  const filename = `delta-${new Date().toISOString()}.json`;
//  
//  //Prepare data
//  let boundary = "-----------------------------11166788396036188132465557338";
//  let formBody = "";
//
//  formBody += `${boundary}\r\n`;
//  formBody += `Content-Disposition: form-data; name="Content-Type"\r\n\r\n`;
//  formBody += `application/json\r\n`;
//  formBody += `${boundary}\r\n`;
//  formBody += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
//  formBody += `Content-Type: application/json\r\n\r\n`;
//  let payload = Buffer.concat([
//    Buffer.from(formBody, "utf8"),
//    Buffer.from(`{ "data": ${JSON.stringify(cachedArray)} }`, "utf8"),
//    Buffer.from(`\r\n${boundary}\r\n`, "utf8")
//  ]);
//
//  console.log("PAYLOAD: \n", payload.toString());
//
//  let options = {
//    hostname: SYNCFILESERVICE,
//    port: 80,
//    method: 'post',
//    path: "/files",
//    headers: {
//      "Content-Type": `multipart/form-data; boundary=${boundary}`,
//      "Content-Length": Buffer.byteLength(payload),
//      "X-Rewrite-URL": "http://producer/"
//    }
//  };
//
//  let responseCallback = (res) => {
//    res.on("data", (data) => console.log);
//    res.on("end", () => {
//      console.log("Successfully posted data to the syncfile service for storage");
//    });
//  };
//
//  let req = http.request(options, responseCallback);
//
//  req.on("error", (err) => {
//    console.error("Posting the delta file to the syncfile services failed! Error message:", err);
//  });
//  req.write(payload);
//  req.end();
//  console.log("Will send delta file to the syncfile service", req);
//
//  //////////////////////////////////////Upload to file service manually in the project
//
//  //try {
//  //  const filename = `delta-${new Date().toISOString()}.json`;
//  //  const filepath = `/${SHAREfOLDER}/${filename}`;
//  //  await fs.writeFile(filepath, JSON.stringify(cachedArray));
//  //  console.log("The file was saved on disk!");
//  //  await writeFileToStore(filename, filepath);
//  //  console.log("The file was saved in the store!");
//  //} catch (e) {
//  //  console.log(e);
//  //}
//}

//async function writeFileToStore(filename, filepath) {
//  const virtualFileUuid  = uuid();
//  const virtualFileUri   = `http://mu.semte.ch/services/poc-diff-producer-service/files/${virtualFileUuid}`;
//  const nowLiteral       = mu.sparqlEscapeDateTime(new Date());
//  const physicalFileUuid = uuid();
//  const physicalFileUri  = `share://${filename}`;
//
//  await update(`
//    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
//    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
//    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
//    PREFIX dbpedia: <http://dbpedia.org/resource/>
//    PREFIX dct: <http://purl.org/dc/terms/>
//
//    INSERT DATA {
//      GRAPH <${FILEGRAPH}> {
//        <${virtualFileUri}> a nfo:FileDataObject ;
//          mu:uuid "${virtualFileUuid}" ;
//          nfo:fileName "${filename}" ;
//          dct:format "application/json" ;
//          dbpedia:fileExtension "json" ;
//          dct:created ${nowLiteral} ;
//          dct:modified ${nowLiteral} ;
//          dct:publisher <http://mu.semte.ch/services/poc-diff-producer-service> .
//        <${physicalFileUri}> a nfo:FileDataObject ;
//          mu:uuid "${physicalFileUuid}" ;
//          nie:dataSource <${virtualFileUri}> ;
//          nfo:fileName "${filename}" ;
//          dct:format "application/json" ;
//          dbpedia:fileExtension "json" ;
//          dct:created ${nowLiteral} ;
//          dct:modified ${nowLiteral} .
//      }
//    }
//  `);
//}

let _SEQ = undefined;

function getNextSequenceNumber() {
  if (! (_SEQ === undefined || _SEQ === false)) {
    return ++_SEQ;
  } else {
    throw "Using the sequenceNumber whithout proper initSequenceNumber.";
  }
}

async function initSequenceNumber() {
  if (!_SEQ) {
    let queryResult = await query(`
      PREFIX de: <http://mu.semte.ch/vocabularies/delta/>

      SELECT ?seq {
        GRAPH ${mu.sparqlEscapeUri(HISTORYGRAPH)} {
          ?s de:sequence ?seq .
        }
      }
      ORDER BY DESC(?seq)
      LIMIT 1
    `);
    console.log("Result from retreiving the sequence number: ", JSON.stringify(queryResult));
    if (queryResult.results.bindings.length == 0) {
      console.log("No sequence number used yet, starting from 1");
      _SEQ = 1;
    } else {
      _SEQ = parseInt(queryResult.results.bindings[0].seq.value);
    }
  }
  console.log("Value for _SEQ was set to ", _SEQ);
  return true;
}

async function getCurrentSequenceNumber() {
  return _SEQ || getNextSequenceNumber();
}

function sparqlEscapeGen(triplePart) {
  if (triplePart.type == "uri") {
    return mu.sparqlEscapeUri(triplePart.value);
  } else {
    let num = Number(triplePart.value);
    if (!Number.isNaN(num)) {
      if (Number.isInteger(num)) {
        return sparqlEscapeInt(triplePart.value)
      } else {
        return sparqlEscapeFloat(triplePart.value);
      }
    } else {
      //Try boolean //TODO
      //Try Date
      try {
        let date = (new Date(triplePart.value)).toISOString();
        if ((new Date(triplePart.value)).toISOString() == triplePart.value) {
          return sparqlEscapeDateTime(triplePart.value);
        }
      }
      finally {
        //Default as string
        return mu.sparqlEscapeString(triplePart.value);
      }
    }
  }
}

async function getDeltasSince(sequence) {
  let queryBody = `
    PREFIX de: <http://mu.semte.ch/vocabularies/delta/>
    SELECT ?s ?p ?o {
      GRAPH ${mu.sparqlEscapeUri(HISTORYGRAPH)} {
        ?s a de:History;
           ?p ?o ;
           de:sequence ?seq .
        FILTER (?seq >= ${sequence}) .
      }
    }
    ORDER BY ?seq
  `;

  let results = await query(queryBody);
  
  let restructuredResults = { updates: results.results.bindings.map((binding) => {
    return {
      subject:   binding.s,
      predicate: binding.p,
      object:    binding.o
    };
  })};

  //console.log("The deltas since:", JSON.stringify(restructuredResults));
  return restructuredResults;
}

