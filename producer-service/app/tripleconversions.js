import * as mu from 'mu';

//Some URI's for the history ontology
const DE_URI      = "http://mu.semte.ch/vocabularies/delta/aboutURI";
const DE_PROP     = "http://mu.semte.ch/vocabularies/delta/aboutProp";
const DE_OLDVALUE = "http://mu.semte.ch/vocabularies/delta/oldValue";
const DE_NEWVALUE = "http://mu.semte.ch/vocabularies/delta/newValue";
const DE_NIL      = "http://mu.semte.ch/vocabularies/delta/nil";

function historyToRegular(historyDeltas) {
  //Sort by sequence number => done because data is always sorted in the store (ORDER BY ?seq) upon retreival
  //When we trust the sorting, cut the list rather naively in pieces about the same history URI
  let separatedDeltas = separateDeltasOnUri(historyDeltas.updates);

  let closeInserts = false;
  let deltas = [], inserts = [], deletes = [];
  let flush = () => {
    deltas.push({ inserts: inserts, deletes: deletes });
    inserts = []; deletes = [];
    closeInserts = false;
  };

  //Updates is now a list of lists with N triples about the same change
  //ForEach over them and store (in order with push at the end) in two separate list: inserts, deletes
  separatedDeltas.forEach((deltagroup) => {
    //Each delta is an array of N like { subject, predicate, object } about a part of a change
    let subject        = deltagroup.find((item) => item.predicate.value === DE_URI).object;
    let predicate      = deltagroup.find((item) => item.predicate.value === DE_PROP).object;
    let objectOldValue = deltagroup.find((item) => item.predicate.value === DE_OLDVALUE).object;
    let objectNewValue = deltagroup.find((item) => item.predicate.value === DE_NEWVALUE).object;
    if (objectOldValue.value === DE_NIL && objectNewValue != DE_NIL) {
      if (closeInserts) {
        //Starting a new bundle
        flush();
      }
      //Dealing with a pure insert
      inserts.push({ subject: subject, predicate: predicate, object: objectNewValue });
    }
    else if (objectNewValue.value != DE_NIL && objectOldValue.value != DE_NIL) {
      //Dealing with a pure update
      //ALWAYS execute updates in separate query, updates can override updates from previous bundles, but when only updates are made they would end up in the same bundle here
      flush();
      inserts.push({ subject: subject, predicate: predicate, object: objectNewValue });
      deletes.push({ subject: subject, predicate: predicate, object: objectOldValue });
    }
    else if (objectNewValue.value === DE_NIL && objectOldValue != DE_NIL) {
      //Dealing with a pure delete
      closeInserts = true;
      deletes.push({ subject: subject, predicate: predicate, object: objectOldValue });
    }
  });
  flush();
  
  //Return the lists
  return { deltas: deltas };
}

function separateDeltasOnUri(historyDeltas) {
  if (historyDeltas.length < 1) return [];

  let separateDeltas = [];
  let currentGroup = [];
  let currentURI = historyDeltas[0].subject.value;

  historyDeltas.forEach((delta) => {
    if (delta.subject.value === currentURI) {
      currentGroup.push(delta);
    } else {
      separateDeltas.push(currentGroup);
      currentGroup = [delta];
      currentURI = delta.subject.value;
    }
  });
  separateDeltas.push(currentGroup);
  return separateDeltas;
}

function tripleToRDF(triple) {
  //Assume of the form { subject: { value: "", type: "", datatype: "" }, predicate: %, object: % }
  //Convert to <URI> <predURI> [<objectURI> | "somevalue"^^xsd:datatype ] .
  const subject   = escapeRDFTerm(triple.subject);
  const predicate = escapeRDFTerm(triple.predicate);
  const object    = escapeRDFTerm(triple.object);
  return `${subject} ${predicate} ${object} . `;
}

function escapeRDFTerm(rdfTerm) {
  const { type, value, datatype, "xml:lang":lang } = rdfTerm;
  switch (type) {
    case "uri":
      return mu.sparqlEscapeUri(value);
    case "typed-literal":
      if (datatype)
        return `${mu.sparqlEscapeString(value)}^^${mu.sparqlEscapeUri(datatype)}`;
    case "literal":
      if (lang)
        return `${mu.sparqlEscapeString(value)}@${lang}`;
      else
        return `${mu.sparqlEscapeString(value)}`;
    default:
      return mu.sparqlEscapeString(value);
  }
}

////Clearly not up to sniff
//function sparqlEscapeGen(triplePart) {
//  if (triplePart.type == "uri") {
//    return mu.sparqlEscapeUri(triplePart.value);
//  } else {
//    let num = Number(triplePart.value);
//    if (!Number.isNaN(num)) {
//      if (Number.isInteger(num)) {
//        return mu.sparqlEscapeInt(triplePart.value)
//      } else {
//        return mu.sparqlEscapeFloat(triplePart.value);
//      }
//    } else {
//      //Try boolean //TODO
//      //Try Date
//      try {
//        let date = (new Date(triplePart.value)).toISOString();
//        if ((new Date(triplePart.value)).toISOString() == triplePart.value) {
//          return mu.sparqlEscapeDateTime(triplePart.value);
//        }
//      }
//      finally {
//        //Default as string
//        return mu.sparqlEscapeString(triplePart.value);
//      }
//    }
//  }
//}

export {
  historyToRegular,
  tripleToRDF,
  escapeRDFTerm
}

