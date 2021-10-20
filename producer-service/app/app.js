// see https://github.com/mu-semtech/mu-javascript-template for more info
import mu from "mu";
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import bodyParser from 'body-parser';
import * as seq from './sequence.js';
import * as tc  from './tripleconversions.js';
import express from 'express';

mu.app.use(bodyParser.json({ type: function(req) { return /^application\/json/.test(req.get('content-type')); } }));

///////////////////////////////////////////////////////////////////////////////
// Constants and public variables
///////////////////////////////////////////////////////////////////////////////

const DELTA_INTERVAL  = process.env.DELTA_INTERVAL_MS || 1000;
const HISTORYGRAPH    = "http://mu.semte.ch/graphs/history";

let queue             = [];
let asyncExectionBusy = false;

///////////////////////////////////////////////////////////////////////////////
// Controller functions
///////////////////////////////////////////////////////////////////////////////

//This is used when the deltanotifier posts a number of deltas
mu.app.post('/delta', async function(req, res) {
  //Body of the request is JSON in the format [ { inserts: [ { value, type } ], deletes: [] } ]
  const body = req.body;

  //Caching the data first is really only necessary when writing to a file, where you could write multiple bundles to the same file. With history, you always need to process the bundels one after the other.
  //console.log(`Pushing onto cache ${JSON.stringify(body)}`);
  //cache.push(...body);
  ////Set the trigger to go off later
  //if (!hasTimeout) {
  //  triggerTimeout();
  //}
  //console.log("Timeout triggered, now returning HTTP code 200");

  //Put the data in the big queue
  body.forEach((bundle) => queue.push(bundle));
  triggerAsyncExecutionOfDeltas();

  //console.log(`Processing: ${JSON.stringify(body)}`);
  //await executeDeltaUpdates(body);

  res.status(200).send("Processed");
});

//This is used when the consumer asks for deltas since a sequence number
mu.app.get('/deltas', async function(req, res) {
  //Get the sequence number from the request and convert. Needed to retrieve deltas since that number.
  const sequence = Number(req.query.sequence);
  console.log("Sequence number: ", sequence);

  //In case the number is missing, critical error
  if (sequence === undefined || (! Number.isInteger(sequence))) {
    res.status(400).send("No sequence number given, or sequence number not a valid integer. To get deltas from the start, use sequence number 0 explicitely. BEWARE: this could produce a very large response!");
    return;
  }

  //Get deltas from the store and send onwards, not much further processing required.
  //Deltas of the form: { updates: [ { subject, predicate, object }, ... ] }
  //Deltas are ORDERED by their sequence number, important!
  try {
    let deltas = await getDeltasSince(sequence);
    res.json(deltas);
  } catch (err) {
    console.error("Error during delta retreival.", err);
    res.status(500).send("Internal server error. Message is: " + err.toString());
  }
});

///////////////////////////////////////////////////////////////////////////////
// Processing functions
///////////////////////////////////////////////////////////////////////////////

//function triggerTimeout() {
//  setTimeout(function () {
//    hasTimeout = false;
//    const data = cache;
//    cache = [];
//    executeDeltaUpdates(data);
//  }, DELTA_INTERVAL);
//}

function triggerAsyncExecutionOfDeltas() {
  if (!asyncExectionBusy) {
    setTimeout(processDeltaUpdate, 0);
    asyncExectionBusy = true;
  }
}

async function processDeltaUpdate() {

  console.log("Starting on a bundle");

  //Pop 1 update bundle from the queue
  let firstBundle = queue.shift();

  try {
    //Process it and wait for it to finish
    await executeDeltaUpdates(firstBundle);
  }
  catch (err) {
    console.error("Processing deltas failed", err);
  }
  finally {
    //If still more bundles, shedule a timeout for the next one
    //If no more bundles, no timeout and release the flag
    if (queue.length > 0) {
      setTimeout(processDeltaUpdate, 0);
      console.log("Bundle finished, next bundle sheduled");
    } else {
      asyncExectionBusy = false;
      console.log("All bundles finished, waiting for the next one.");
    }
  }
}

function executeDeltaUpdates(bundle) {

  //console.log("These are the updates:", JSON.stringify(data));
  //console.log("Inserting deltas as history in the database");
  
  let storeP = Promise.resolve(true);
  
  try {
    //for (let bundle of bundles) {
      //Find updates, rather than only deletes and inserts
      const filteredTriples = splitUpdatesApart(bundle);
      const updates = filteredTriples.updates;
      const inserts = filteredTriples.inserts;
      const deletes = filteredTriples.deletes;

      //console.log(`Found ${updates.length} updates.`);
      //console.log("Split the data; inserts:", inserts);
      //console.log("Split the data; updates:", updates);
      //console.log("Split the data; deletes:", deletes);

      //Write history triples to the store
      storeP = storeP.then(() => storeUpdates(inserts, "insert"))
                     .then(() => storeUpdates(updates, "update"))
                     .then(() => storeUpdates(deletes, "delete"));
    //}
  }
  catch (err) {
    console.error(err);
  }

  //console.log("Done inserting deltas as history");

  return storeP;
}

async function storeUpdates(triples, type) {
  //Premature stop when no triples
  if (triples.length == 0) return;

  let needsOldValue, needsNewValue;
  switch (type) {
    case "update":
      needsOldValue = true;  needsNewValue = true;  break;
    case "insert":
      needsOldValue = false; needsNewValue = true;  break;
    case "delete":
      needsOldValue = true;  needsNewValue = false; break;
    default:
      needsOldValue = true;  needsNewValue = true;  break;
  }

  let queryBodies = [];
  //Loop over the triples and create the proper statments per triple
  //Using a for...of... loop because of the promise from seq instead of a nicer looking map.
  for (let triple of triples) {
    let sequence = await seq.getNextAndSet();
    let queryBody = `
          de:change${sequence}
            a            de:History ;
            de:aboutURI  ${tc.escapeRDFTerm(triple.subject)} ;
            de:aboutProp ${tc.escapeRDFTerm(triple.predicate)} ;
            de:oldValue  ${needsOldValue ? tc.escapeRDFTerm(triple.object) : "de:nil"} ;
            de:newValue  ${needsNewValue ? tc.escapeRDFTerm(triple.object) : "de:nil"} ;
            de:sequence  ${mu.sparqlEscapeInt(sequence)} ;
            de:timeStamp ${mu.sparqlEscapeDateTime(new Date())} .
    `;
    queryBodies.push(queryBody);
  }

  let queryFull = `
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX de:  <http://mu.semte.ch/vocabularies/delta/>

    INSERT DATA {
      GRAPH ${mu.sparqlEscapeUri(HISTORYGRAPH)} {
        ${queryBodies.join("\n")}
      }
    }
  `;
  //console.log("Full query:", queryFull);
  //console.log("Will execute the last printed full query");
  return update(queryFull);
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

///////////////////////////////////////////////////////////////////////////////
// Helper functions
///////////////////////////////////////////////////////////////////////////////

function splitUpdatesApart(bundle) {
  //This takes a bundle of inserst and deletes and detect naively for matches between the two. These are updates rather than pure inserts of deletes. (E.g. renaming the name of a book)

  //Define equality for triple
  let tripleEquals = (t1, t2) => t1.subject.value === t2.subject.value && t1.predicate.value === t2.predicate.value;

  let inserts = bundle.inserts;
  let deletes = bundle.deletes;

  let updates    = [];
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

Array.prototype.popStart = function () {
  let first = (this.length > 0) ? this[0] : undefined;
  this.splice(1);
  return first;
}

