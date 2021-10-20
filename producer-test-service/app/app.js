import { app, query, update, errorHandler } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import http from "http";
import express from 'express';
import * as book from './Book.js';
import * as tq from './testqueries.js';
import * as diff from "diff";
import * as f from './files.js';
//import * as diff2html from "diff2html";

//Names for communicating to the consumer
const TUNNEL_BASE            = process.env.TUNNEL_BASE          || 'tunnel';
const TUNNEL_PATH            = process.env.TUNNEL_PATH          || '/out';
const TUNNEL_DEST_IDENTITY   = process.env.TUNNEL_DEST_IDENTITY || 'consumer@redpencil.io';
const CONSUMERTEST_BASE_URL  = process.env.DELTA_BASE_URL       || 'http://consumertest';
const CONSUMER_ENDPOINT      = `${CONSUMERTEST_BASE_URL}/doquery`;

//app.use(express.json());

app.get("/clear", async function(req, res) {
  //Drop all data in databases used by testing

  //Send query to consumer side
  await sendQuery(tq.clearPublic());
  await sendQuery(tq.clearHistory());
  
  //Also clear the database on the producer side
  await updateSudo(tq.clearPublic());
  await updateSudo(tq.clearHistory());
  
  //Reset the counter
  book.clear();

  res.status(200).json({ status: "Databases cleared" });
});

app.get("/test", async function(req, res) {
  //Insert data

  let books, queryBody, query, allBooks;
  allBooks = [];
  //Large set of data at first in chunks, because the database cannot handle such large history queries
  for (let i = 0; i < 10; i++) {
    books     = book.makeBooks(10);
    queryBody = books.map((b) => b.insertQueryBody()).join("\n ");
    query     = tq.insertDataPublic(queryBody);
    allBooks  = allBooks.concat(books);
    await update(query);
  }
  
  //Make updates to some items
  let changes     = book.changeRandomBooks(3, books);
  let inserts     = changes.map((change) => change.inserts).join(" ");
  let deletes     = changes.map((change) => change.deletes).join(" ");
  let queryChange = tq.changeDataPublic(inserts, deletes);
  await update(queryChange);
  
  //Make updates to the same item in a row
  let changingBook = allBooks[5];
  for (let i = 0; i < 10; i++) {
    changes = changingBook.changeAndQueryBodies();
    await update(tq.changeDataPublic(changes.inserts, changes.deletes));
  }
  
  //Remove a bunch
  let picks   = book.pickRandomBooks(10, allBooks);
  deletes = picks.map((book) => book.deleteQueryBody()).join(" ");
  
  //Insert some more
  books     = book.makeBooks(10);
  queryBody = books.map((b) => b.insertQueryBody()).join("\n ");
  query     = tq.insertDataPublic(queryBody);
  allBooks  = allBooks.concat(books);
  await update(query);

  res.status(200).json({ executed: query });
});

app.get("/test1", async function(req, res) {
  //This tests the insertion of 1 book
  //Focus on getting the history correct

  //Create a public query for some book and execute
  let books     = book.makeBooks(1);
  let queryBody = books.map((b) => b.insertQueryBody()).join("");
  let query     = tq.insertDataPublic(queryBody);
  await update(query);

  res.status(200).json({ executed: query });
});

app.get("/test2", async function(req, res) {
  //This tests the insertion of 1 book and removal of the same book
  //Focus on getting the history correct

  //Create a public query for some book and execute
  let books     = book.makeBooks(1);
  let queryBody = books.map((b) => b.insertQueryBody()).join("");
  let query     = tq.insertDataPublic(queryBody);
  await update(query);

  let queryRemove = tq.removeDataPublic(queryBody);
  await update(queryRemove);

  res.status(200).json({ executed: [ query, queryRemove ] });
});

app.get("/test3", async function(req, res) {
  //This tests the insertion of 1 book and the change of the same book
  //Focus on getting the history correct

  //Create a public query for some book and execute
  let books     = book.makeBooks(1);
  let queryBody = books.map((b) => b.insertQueryBody()).join("");
  let query     = tq.insertDataPublic(queryBody);
  await update(query);

  //Bring a change to the book
  let changes     = books.map((book) => book.changeAndQueryBodies());
  let inserts     = changes.map((change) => change.inserts).join(" ");
  let deletes     = changes.map((change) => change.deletes).join(" ");
  let queryChange = tq.changeDataPublic(inserts, deletes);
  await update(queryChange);

  res.status(200).json({ executed: [ query, queryChange ] });
});

app.get("/testFile1", async function(req, res) {
  //Upload a file with some random data to the file service
  let result = f.saveFile();
  res.status(200).json({ result });
});

app.get("/testFile2", async function(req, res) {
  //Upload a file with some random data to the file service
  let result = [];
  for (let i = 0; i < 5; i++) {
    result.push(f.saveFile());
  }
  await Promise.all(result);
  res.status(200).json({ result });
});

app.get("/check", async function(req, res) {
  //Retreive history data from both databases and check equality
  let qPublic  = tq.retrievePublic();
  let qHistory = tq.retrieveHistory();

  //Retrieve all data from both databases
  let localPublicResults   = await querySudo(qPublic);
  let remotePublicResults  = await sendQuery(qPublic);
  let localHistoryResults  = await querySudo(qHistory);
  let remoteHistoryResults = await sendQuery(qHistory);
  
  console.log("All data retreived, now diffing");

  //Check equality between databases
  let publicDiffs  = diff.diffJson(localPublicResults.results.bindings,  remotePublicResults.results.bindings);
  let historyDiffs = diff.diffJson(localHistoryResults.results.bindings, remoteHistoryResults.results.bindings);

  ////Check equality between databases, based on string versions of the JSON data
  //console.log("Stringifying local data");
  //let localPublic   = JSON.stringify(localPublicResults.results.bindings);
  //let remotePublic  = JSON.stringify(remotePublicResults.results.bindings);
  //let localHistory  = JSON.stringify(localHistoryResults.results.bindings);
  //let remoteHistory = JSON.stringify(remoteHistoryResults.results.bindings);
  //let publicDiffs   = diff.diffChars(localPublic, remotePublic);
  //let historyDiffs  = diff.diffChars(localHistory, remoteHistory);

  //let nicePublicDiffs  = diff2html.html(publicDiffs);
  //let niceHistoryDiffs = diff2html.html(historyDiffs);

  //res.set('Content-Type', 'text/plain');
  //res.send(nicePublicDiffs);

  console.log("Diffing done, now checking if something is actually different");

  //Find if there is at least one difference
  let someDiffPublic  =  publicDiffs.some((diff) => diff.added || diff.removed);
  let someDiffHistory = historyDiffs.some((diff) => diff.added || diff.removed);

  console.log("All processing done, now sending back the result");

  let overalDiffPublic  = someDiffPublic  ? "PUBLIC DATA IS NOT IDENTICAL!"  : "Public data is identical, good!";
  let overalDiffHistory = someDiffHistory ? "HISTORY DATA IS NOT IDENTICAL!" : "History data is identical, good!";

  //Send back a 'nice' report of some interesting data
  res.json({
    summary: {
      public:  overalDiffPublic,
      history: overalDiffHistory
    },
    diffresults: {
      public:       publicDiffs,
      historyDiffs: historyDiffs
    },
    rawresults: {
      localPublicResults, remotePublicResults, localHistoryResults, remoteHistoryResults
    }
  });
});

async function sendQuery(query) {
  return new Promise((resolve, reject) => {
    let postData = JSON.stringify({
      peer:   TUNNEL_DEST_IDENTITY,
      method: "POST",
      url:    CONSUMER_ENDPOINT,
      headers: {
        "Content-Type": "text/plain",
        "Accept":       "application/vnd.api+json"
      },
      body: Buffer.from(query).toString("base64")
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

    let response = [];

    let req = http.request(options, (res) => {
      res.on("data", (chunck) => {
        response.push(chunck);
      });

      res.on("end", () => {
        //Data fully came through now
        response = JSON.parse(response.join(""));
        resolve(response);
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

app.use(errorHandler);

