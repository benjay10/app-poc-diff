// see https://github.com/mu-semtech/mu-javascript-template for more info
//import { app, errorHandler, uuid, sparqlEscapeDateTime } from 'mu';
import mu from "mu";
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import fs from 'fs-extra';
import bodyParser from 'body-parser';
import http from "http";

mu.app.use(bodyParser.json({ type: function(req) { return /^application\/json/.test(req.get('content-type')); } }));

const DELTA_INTERVAL  = process.env.DELTA_INTERVAL_MS || 1000;
const HISTORYGRAPH    = "http://mu.semte.ch/graphs/history";

let cache      = [];
let hasTimeout = null;

mu.app.post('/delta', function(req, res) {
  const body = req.body;

  //console.log(`Pushing onto cache ${JSON.stringify(body)}`);

  cache.push(...body);

  if(!hasTimeout) {
    triggerTimeout();
  }

  res.status(200).send("Processed");
});

mu.app.get('/deltas', async function(req, res) {
  const sequence = Number(req.query.sequence);
  console.log("Sequence number: ", sequence);
  if (sequence === undefined || (! Number.isInteger(sequence))) {
    res.status(400).send("No sequence number given, or sequence number not a valid integer. To get deltas from the start, use sequence number 0 explicitely. BEWARE: this could produce a very large response!");
    return;
  }
  try {
    let deltas = await getDeltasSince(sequence);
    res.json(deltas);
  } catch (err) {
    console.error("Error during delta retreival.", err);
    res.status(500).send("Internal server error. Message is: ", err);
  }
});

function triggerTimeout() {
  setTimeout(executeDeltaUpdates, DELTA_INTERVAL);
  hasTimeout = true;
}

async function executeDeltaUpdates() {
  const data = cache;
  cache = [];

  //console.log("These are the updates:", JSON.stringify(data));
  
  //Data is array of bundels of triples, keep them in bundles because that ordering is important for now

  data.map((bundle) => {
    //Find updates, rather than only deletes and inserts
    const filteredTriples = splitUpdatesApart(bundle);
    const updates = filteredTriples.updates;
    const inserts = filteredTriples.inserts;
    const deletes = filteredTriples.deletes;

    //console.log("Split the data; inserts:", inserts);
    //console.log("Split the data; updates:", updates);
    //console.log("Split the data; deletes:", deletes);

    executeUpdates(inserts, "insert");
    executeUpdates(updates, "update");
    executeUpdates(deletes, "delete");
    hasTimeout = false;
  });
}

async function executeUpdates(triples, type) {
  if (triples.length == 0) return;
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
  //console.log("Full query:", queryFull);
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
    //console.log("Result from retreiving the sequence number: ", JSON.stringify(queryResult));
    if (queryResult.results.bindings.length == 0) {
      //console.log("No sequence number used yet, starting from 1");
      _SEQ = 1;
    } else {
      _SEQ = parseInt(queryResult.results.bindings[0].seq.value);
    }
  }
  //console.log("Value for _SEQ was set to ", _SEQ);
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

