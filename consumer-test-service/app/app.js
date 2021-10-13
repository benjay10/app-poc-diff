import { app, query, update, errorHandler } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import express from 'express';

app.use(express.text());

app.post("/doquery", async function(req, res) {
	console.log("Received query to execute:", req.body.toString());
	let result = await querySudo(req.body);
	res.json(result);
});

app.use(errorHandler);

