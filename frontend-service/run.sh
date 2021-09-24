#!/bin/bash

docker run \
	--name frontendAppContainer \
	-i --tty \
	--volume `pwd`/webapp/:/webapp/ \
	--publish 80:4200 \
	frontendapp:latest

