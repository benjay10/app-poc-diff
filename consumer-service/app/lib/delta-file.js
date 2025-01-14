import requestPromise from 'request-promise';
import fs from 'fs-extra';
import request from 'request';
import { sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';

const TUNNEL_ENDPOINT        = process.env.TUNNEL_ENDPOINT      || 'http://tunnel/out';
const TUNNEL_DEST_IDENTITY   = process.env.TUNNEL_DEST_IDENTITY || 'producer@redpencil.io';
const SYNC_BASE_URL          = process.env.SYNC_BASE_URL        || 'http://identifier';
const SYNC_FILES_ENDPOINT    = `${SYNC_BASE_URL}/sync/files`;
const DOWNLOAD_FILE_ENDPOINT = `${SYNC_BASE_URL}/syncfiles/:id/download`;

class DeltaFile {
  constructor(data) {
    this.id      = data.id;
    this.created = data.attributes.created;
    this.name    = data.attributes.name;
  }

  get downloadUrl() {
    return DOWNLOAD_FILE_ENDPOINT.replace(':id', this.id);
  }

  get tmpFilepath() {
    return `/tmp/${this.id}.json`;
  }

  async consume(onFinish) {
    const writeStream = fs.createWriteStream(this.tmpFilepath);
    writeStream.on('finish', () => this.ingest(onFinish));

    try {
      request({
        method: 'POST',
        uri:    TUNNEL_ENDPOINT,
        body: {
          peer:   TUNNEL_DEST_IDENTITY,
          method: "GET",
          url:    this.downloadUrl
        },
        json: true})
        .on('error', function(err) {
          console.log(`Something went wrong while downloading file from ${this.downloadUrl}`);
          console.log(err);
          throw err;
        })
        .pipe(writeStream);
    } catch (e) {
      console.log(`Something went wrong while consuming the file ${this.id}`);
      throw e;
    }

  }

  async ingest(onFinish) {
    console.log(`Start ingesting file ${this.id} stored at ${this.tmpFilepath}`);
    try {
      const changeSets = await fs.readJson(this.tmpFilepath, { encoding: 'utf-8' });
      for (let { inserts, deletes } of changeSets) {
        //Filter out triples about files
        let insertsFiltered = filterFileTriples(inserts);
        let insertsNoFiles  = insertsFiltered.triplesNoFiles;
        let insertsFiles    = insertsFiltered.triplesFiles;
        let deletesFiltered = filterFileTriples(deletes);
        let deletesNoFiles  = deletesFiltered.triplesNoFiles;
        let deletesFiles    = deletesFiltered.triplesFiles;

        //Deal with files
        await insertFiles(insertsFiles);
        await deleteFiles(deletesFiles);

        //Deal with the triples (in this order!)
        await insertTriples(insertsNoFiles);
        await deleteTriples(deletesNoFiles);
      }
      console.log(`Successfully finished ingesting file ${this.id} stored at ${this.tmpFilepath}`);
      await onFinish(this, true);
      await fs.unlink(this.tmpFilepath);
    } catch (e) {
      await onFinish(this, false);
      console.log(`Something went wrong while ingesting file ${this.id} stored at ${this.tmpFilepath}`);
      console.log(e);
    }
  }
}

async function getUnconsumedFiles(since) {
  try {
    const result = await requestPromise({
      method: 'POST',
      uri:    TUNNEL_ENDPOINT,
      body: {
        peer:   TUNNEL_DEST_IDENTITY,
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.api+json'
        },
        url:    `${SYNC_FILES_ENDPOINT}?since=${since.toISOString()}`
      },
      json:   true // Automatically parses the JSON string in the response
    });
    return result.data.map(f => new DeltaFile(f));
  } catch (e) {
    console.log(`Unable to retrieve unconsumed files from ${SYNC_FILES_ENDPOINT}`);
    throw e;
  }
}

async function filterFileTriples(triples) {
  //Find all the URI's for files (assume triples in random order)
  const fileUris = triples.filter((triple) =>
    triple.subject.type  == "uri" &&
    triple.subject.value == "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject"
  ).map((triple) => triple.subject.value);

  //Find all triples related to the file objects and the others
  const partedArray = partition(triples, (triple) => fileUris.includes(triple.subject.value));
  return { triplesFiles: partedArray.passes, triplesNoFiles: partedArray.fails };
}

function partition(array, pred) {
  //Split an array into 2 new arrays, where the first contains the elements that pass the predicate and the second that does not pass the predicate.
  //Returns the form { passes: [...], fails: [...] }
  let passArray = [], failsArray = [];
  array.forEach((item) => (pred(item) ? passArray : failsArray).push(item));
  return { passes: passArray, fails: failsArray };
}

async function insertFiles(triples) {
  //TODO implement
  console.log("Found some files to be imported", triples);
}

async function deleteFiles(triples) {
  //TODO implement
  console.log("Found some files to be deleted", triples);
}

async function insertTriples(triples) {
  // TODO insert in batches of 1000 or will this be handled by mu-authorization?
  if (triples.length) {
    const statements = toStatements(triples);

    await update(`
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${statements}
      }
    }
  `);
  }
}

async function deleteTriples(triples) {
  // TODO delete in batches of 1000 or will this be handled by mu-authorization?
  if (triples.length) {
    const statements = toStatements(triples);

    await update(`
    DELETE DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ${statements}
      }
    }
  `);
  }
}

function toStatements(triples) {
  const escape = function(rdfTerm) {
    const { type, value, datatype, "xml:lang":lang } = rdfTerm;
    if (type == "uri") {
      return sparqlEscapeUri(value);
    } else if (type == "literal") {
      if (datatype)
        return `${sparqlEscapeString(value)}^^${sparqlEscapeUri(datatype)}`;
      else if (lang)
        return `${sparqlEscapeString(value)}@${lang}`;
      else
        return `${sparqlEscapeString(value)}`;
    } else
      console.log(`Don't know how to escape type ${type}. Will escape as a string.`);
      return sparqlEscapeString(value);
  };
  return triples.map(function(t) {
    const subject   = escape(t.subject);
    const predicate = escape(t.predicate);
    const object    = escape(t.object);
    return `${subject} ${predicate} ${object} . `;
  }).join('');
}

export {
  getUnconsumedFiles
}

