const PUBLIC_GRAPH       = "http://mu.semte.ch/graphs/public";
const APPLICATION_GRAPH  = "http://mu.semte.ch/application";
const HISTORY_GRAPH      = "http://mu.semte.ch/graphs/history";
const PREFIXES           = `
  PREFIX mu:      <http://mu.semte.ch/vocabularies/core/>
  PREFIX bks:     <http://mu.semte.ch/services/github/madnificent/book-service/books/>
  PREFIX sch:     <http://schema.org/>
  PREFIX nfo:     <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX nie:     <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
  PREFIX dct:     <http://purl.org/dc/terms/>
  PREFIX dbpedia: <http://dbpedia.org/ontology/>
  PREFIX de:      <http://mu.semte.ch/vocabularies/delta/> 
`;

function clearHistory() {
  return `
    DELETE {
      GRAPH <${HISTORY_GRAPH}> {
        ?s ?p ?o .
      }
    }
    WHERE {
      GRAPH <${HISTORY_GRAPH}> {
        ?s ?p ?o .
      }
    }
  `;
}

function clearPublic() {
  return `
    DELETE {
      GRAPH <${PUBLIC_GRAPH}> {
        ?s ?p ?o .
      }
    }
    WHERE {
      GRAPH <${PUBLIC_GRAPH}> {
        ?s ?p ?o .
      }
    }
  `;
}

function retrieveHistory() {
  return `
    SELECT ?s ?p ?o {
      GRAPH <${HISTORY_GRAPH}> {
        ?s ?p ?o .
      }
    }
    ORDER BY ?s ?p
  `;
}

function retrievePublic() {
  return `
    SELECT ?s ?p ?o {
      GRAPH <${PUBLIC_GRAPH}> {
        ?s ?p ?o .
      }
    }
    ORDER BY ?s ?p
  `;
}

function updateData(graph, queryBody, method) {
  let query;
  if (method === "DELETE" || method === "INSERT") {
    query = `
      ${PREFIXES}

      ${method} DATA {
        GRAPH <${graph}> {
          ${queryBody}
        }
      }
    `;
  } else {
    query = `
      ${PREFIXES}

      DELETE {
        GRAPH <${graph}> {
          ${queryBody.deletes}
        }
      }
      INSERT {
        GRAPH <${graph}> {
          ${queryBody.inserts}
        }
      }
      WHERE {
        GRAPH <${graph}> {
          ${queryBody.deletes}
        }
      }
    `;
  }
  return query;
}

function removeDataPublic(queryBody) {
  return updateData(APPLICATION_GRAPH, queryBody, "DELETE");
}

function insertDataPublic(queryBody) {
  return updateData(APPLICATION_GRAPH, queryBody, "INSERT");
}

function changeDataPublic(deletes, inserts) {
  return updateData(APPLICATION_GRAPH, { inserts, deletes }, "UPDATE");
}

export {
  clearPublic,
  clearHistory,
  insertDataPublic,
  removeDataPublic,
  changeDataPublic,
  retrievePublic,
  retrieveHistory
}
