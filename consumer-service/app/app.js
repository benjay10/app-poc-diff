import requestPromise from 'request-promise';
import { app, errorHandler, query, update } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import * as mu from 'mu';
import * as seq from './sequence.js';
import * as tc from './tripleconversions.js';
import http from "http";
import fs from "fs";

///////////////////////////////////////////////////////////////////////////////
// Constants and public variables
///////////////////////////////////////////////////////////////////////////////

const INGEST_INTERVAL = process.env.INGEST_INTERVAL_MS || 5000;
const HISTORYGRAPH    = "http://mu.semte.ch/graphs/history";
const MU_UUID         = "http://mu.semte.ch/vocabularies/core/uuid";
const NIE_DATASOURCE  = "http://www.semanticdesktop.org/ontologies/2007/01/19/nie#dataSource";
const DBP_FILEEXT     = "http://dbpedia.org/ontology/fileExtension";

//For retreiving
const TUNNEL_BASE          = process.env.TUNNEL_BASE          || 'tunnel';
const TUNNEL_PATH          = process.env.TUNNEL_PATH          || '/out';
const TUNNEL_DEST_IDENTITY = process.env.TUNNEL_DEST_IDENTITY || 'producer@redpencil.io';
const DELTA_BASE_URL       = process.env.DELTA_BASE_URL       || 'http://producer';
const DELTA_ENDPOINT       = `${DELTA_BASE_URL}/deltas?sequence=:seq`;
const FILE_DL_URL          = process.env.FILE_DL_URL          || 'http://identifier/api/files/:id/download';

//Path to local storage
const LOCAL_STORAGE_PATH = "/share/";

///////////////////////////////////////////////////////////////////////////////
// Controller functions
///////////////////////////////////////////////////////////////////////////////

app.get('/ingest', async function(req, res, next) {
  try {
    let result = await ingestDeltas();
    res.status(200).json({ "result": result });
  }
  catch (err) {
    console.trace(err);
    res.status(500).json({ "error": JSON.stringify(err) });
  }
});

async function triggerIngest() {
  console.log(`Consuming deltas at ${new Date().toISOString()}`);
  //requestPromise.post('http://localhost/ingest/');
  await ingestDeltas();
  setTimeout(triggerIngest, INGEST_INTERVAL);
}

//triggerIngest();

///////////////////////////////////////////////////////////////////////////////
// Processing functions
///////////////////////////////////////////////////////////////////////////////

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
  
  //Filter bundles into bundles about files and bundles not about files. (NF = NoFiles, F = Files)
  const filteredBundles = filterFilesOnBundles(regularDeltas.deltas);
  //console.log("Filtered Bundles", JSON.stringify(filteredBundles));
  const regularDeltasNF = filteredBundles.bundlesNoFiles;
  const regularDeltasF  = filteredBundles.bundlesFiles;
  
  //Save triples in own store (that are not about files)
  await storeDeltas(regularDeltasNF);
  
  //Retreive files, store locally, and update file information
  //TODO consider using the FileService? We will not have to store the file triples, but get information from the file service and change the history to make it consistent. OR find a better way to decrease the overlap of this and the file service.
  await processFilesAndStoreDeltas(regularDeltasF);
  
  //TODO update task status and end sequence number
  
  //Important to invalidate the seq. Will need to be retreived from store on next round, or needs to be updated from the historyDeltas (rather complex and much work for little improvements).
  await seq.invalidate();
  return filteredBundles;
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

async function processFilesAndStoreDeltas(bundles) {
  console.log("Processing files and storing deltas");
  if (bundles.length < 1) return;
  //Do per bundle
    //Find distinct file uuid's for insert and delete
    //Inserts: download file from other stack, put on storage as uuid.extension, storeInserts(inserts) like normal
    //Deletes: remove file in storage with that uuid.extension, storeDeletest(deletes) like normal

  for (let bundle of bundles) {
    //let insertFileUUIDs = getUUIDsFromTriples(bundle.inserts);
    //let deleteFileUUIDs = getUUIDsFromTriples(bundle.deletes);

    //Get some data of the form: [ { vuuid: "3453", puuid: "3454",  ext: "rdf" }, ... ]
    let insertFilesExt = getFileUUIDExts(bundle.inserts);
    let deleteFilesExt = getFileUUIDExts(bundle.deletes);

    for (let file of insertFilesExt) {
      //Go download all the files from the other stack and save locally
      //TODO await? Can we do multiple downloads at once using JS's IO multithreading? How many at most?
      console.log("Starting the download process");
      await downloadAndSaveFile(file.vuuid, file.puuid, file.ext);
    }
    //Also store the file triples in the database
    await storeInserts(bundle.inserts);

    for (let file of deleteFilesExt) {
      //Delete files from local storage
      await deleteFile(`${file.puuid}.${file.ext}`); //TODO see previous todo
    }
  
    //Also store/delete the file triples in the database
    await storeDeletes(bundle.deletes);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Store functions
///////////////////////////////////////////////////////////////////////////////

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
    //TODO do we really have to await here? History can be inserted at random, all at once, they are ordered in the data itself.
    await updateSudo(queryBody); //As mu-auth-sudo, no hindering and no deltas produced
    i += slicesize;
  }
  //TODO maybe one await for all queries to have finished.

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
  for (let bundle of regularDeltas) {
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
  
  //Split queries into slices of a certain size not to overload poor Virtuoso
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

  //Split queries into slices of a certain size not to overload poor Virtuoso
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

///////////////////////////////////////////////////////////////////////////////
// File function 
///////////////////////////////////////////////////////////////////////////////

async function deleteFile(name) {
  let path = LOCAL_STORAGE_PATH.concat(name);
  console.log("Removing file with path:", path);
  return new Promise((resolve, reject) => {
    fs.rm(path, { force: false }, err => {
      if (err)
        reject(err)
      else {
        console.log("Removing file gave message:", err);
        resolve()
      }
    });
  });
}

async function downloadAndSaveFile(vuuid, puuid, ext) {

  //The data for the tunnel, will be posted to it
  let postData = JSON.stringify({
    peer:   TUNNEL_DEST_IDENTITY,
    method: 'GET',
    url:    FILE_DL_URL.replace(":id", vuuid)
  });

  //The options for the http request to the tunnel
  let options = {
    method:   'POST',
    hostname: TUNNEL_BASE,
    path:     TUNNEL_PATH,
    port:     80,
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log("Will download the file with uuid", vuuid);

  return new Promise((resolve, reject) => {

    //Setup the http request to the tunnel
    let req = http.request(options);

    req.on("response", (res) => {
      console.log("Inside the callback of the request.");
      //Open FileHandle and create WriteStream to it
      //FOR NODE 16 and up:
        //let writeFileHandle = await fs.open(`${puuid}.${ext}`, "wx");
        //let writeStream     = await writeFileHandle.createWriteStream();
      //FOR NODE 14:
      let writeStream = fs.createWriteStream(`${LOCAL_STORAGE_PATH}/${puuid}.${ext}`, { flags: "wx" });
      //You would want to use flags wx to prevent file from being overwritten
      //let writeStream = fs.createWriteStream(`${LOCAL_STORAGE_PATH}/${puuid}.${ext}`, { flags: "w" });
      console.log("Opened writeStream");
      //Close the file properly
      //FOR NODE 16 and up:
        //writeFileHandle.on("finish", () => writeFileHandle.close());
      //FOR NODE 14:
      writeStream.on("finish", () => {
        console.log("Closing the writeStream");
        writeStream.close();
      });
      writeStream.on("error", (err) => {
        if (err.errno == -17) {
          console.log("File already exists on local storage, ignoring");
          resolve();
        } else {
          reject(err);
        }
      });
      console.log("Placed a listener on finish");
      //On request finishing, pipe data directly to a file
      res.pipe(writeStream);
      console.log("Piped the streams");

      //res.on("data", (chunk) => {
      //  console.log("Recieved a chunk of data: ", chunk.toString());
      //});
      //

      res.on("error", (err) => {
        console.error("Error on the response for file download", err);
        console.log("Closing the writeStream");
        writeStream.close();
        reject(err);
      });

      res.on("end", () => {
        console.log("End of the request reached with statuscode: ", res.statusCode);
        console.log("Closing the writeStream");
        writeStream.close();
        resolve();
      });
    });

    req.on("timeout", (err) => {
      console.error(err);
      req.destroy();
      reject(err);
    });

    req.on("end", () => {
      resolve();
    });

    console.log("Placed all listeners in place");
    
    //Send the data via the request and flush it.
    req.write(postData)
    req.end();
  });
}

///////////////////////////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////////////////////////

Array.prototype.partition = function (pred) {
  //Split the array into 2 new arrays, where the first contains the elements that pass the predicate and the second that does not pass the predicate.
  //Returns the form { passes: [...], fails: [...] }
  let passArray = [], failsArray = [];
  this.forEach((item) => (pred(item) ? passArray : failsArray).push(item));
  return { passes: passArray, fails: failsArray };
}

function filterFilesOnBundles(bundles) {
  //console.log("Filtering files from the bundles", JSON.stringify(bundles));
  //On bundles with inserts and deletes, create bundles that have files and no files.
  let bundlesFiles = [], bundlesNoFiles = [];
  let filteredInserts, filteredDeletes;

  for (let bundle of bundles) {
    filteredInserts = filterFileTriples(bundle.inserts);
    filteredDeletes = filterFileTriples(bundle.deletes);
    //In order to avoid having to do something like a flatmap, only insert when exists
    if (filteredInserts.triplesFiles.length > 0 || filteredDeletes.triplesFiles.length > 0)
      bundlesFiles.push({
        inserts: filteredInserts.triplesFiles,
        deletes: filteredDeletes.triplesFiles
      });
    if (filteredInserts.triplesNoFiles.length > 0 || filteredDeletes.triplesNoFiles.length > 0)
      bundlesNoFiles.push({
        inserts: filteredInserts.triplesNoFiles,
        deletes: filteredDeletes.triplesNoFiles
      });
  }

  return { bundlesFiles, bundlesNoFiles };
}

function filterFileTriples(triples) {
  //Find all the URI's for files (assume triples in random order)
  const fileUris = triples.filter((triple) =>
    triple.object.type  == "uri" &&
    triple.object.value == "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject"
  ).map((triple) => triple.subject.value);

  //Find all triples related to the file objects and the others
  const partedArray = triples.partition((triple) => fileUris.includes(triple.subject.value));
  return { triplesFiles: partedArray.passes, triplesNoFiles: partedArray.fails };
}

//function getUUIDsFromTriples(triples) {
//  return new Set(triples.filter((triple) => triple.predicate === MU_UUID).map((triple) => triple.object.value));
//}

function getFileUUIDExts(triples) {
  //Return data of the form [ { vuuid: "2345", puuid: "3453", ext: "rdf" }, ... ]
  //This could be much cleaner with a nice database framework to abstrat on triple data in JSON format
  const sourceTriples = triples.filter((triple) => triple.predicate.value === NIE_DATASOURCE);
  //Get the relevant URI's
  const fileURIs = sourceTriples.map((triple) => {
    return {
      puri: triple.subject.value,
      vuri: triple.object.value 
    };
  });
  //Search uuid's for the URI's
  fileURIs.forEach((file) => {
    file.puuid = triples.find((uris) => uris.subject.value === file.puri && uris.predicate.value === MU_UUID).object.value;
    file.vuuid = triples.find((uris) => uris.subject.value === file.vuri && uris.predicate.value === MU_UUID).object.value;
  });

  let results = [];
  for (let uris of fileURIs) {
    let ext = triples.filter((triple) => triple.predicate.value === DBP_FILEEXT && triple.subject.value === uris.puri)
                     .map((triple) => triple.object.value)[0];
    //let uuid = triples.filter((triple) => triple.predicate.value === MU_UUID && triple.subject.value === uri)
    //                  .map((triple) => triple.object.value)[0];
    results.push({ vuuid: uris.vuuid,  puuid: uris.puuid, ext: ext });
  }
  return results;
}

