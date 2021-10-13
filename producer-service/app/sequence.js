import mu, { query, update } from "mu";
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';

const HISTORYGRAPH = "http://mu.semte.ch/graphs/history";
let _SEQ = undefined;

async function init() {
  if (_SEQ === undefined || _SEQ === false) {
    let queryResult = await querySudo(`
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
      //console.log("No sequence number used yet, starting from 0");
      _SEQ = 0;
    } else {
      _SEQ = Number(queryResult.results.bindings[0].seq.value);
    }
  }
  //console.log("Value for _SEQ was set to ", _SEQ);
  return _SEQ;
}

async function getCurrent() {
  return await init();
}

async function getNext() {
  return await init() + 1;
}

async function getNextAndSet() {
  _SEQ = (await init()) + 1;
  return _SEQ;
}

async function set(newSeq) {
  if (newSeq > _SEQ) {
    _SEQ = newSeq;
  } else {
    throw "Cannot set the sequence number to a value lower than the already set sequence number. This can cause problems.";
  }
}

async function invalidate() {
  //Can be used to force database lookup on the next use
  _SEQ = undefined;
}

export {
  init,
  getCurrent,
  getNext,
  getNextAndSet,
  set,
  invalidate
}

