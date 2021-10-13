#!/bin/bash

docker run \
	--name consumerTestContainer \
	-i --tty \
	--volume `pwd`/app/:/app/ \
	--publish 85:80 \
	consumertestservice:latest

