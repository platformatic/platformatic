#!/bin/sh

# This is meant to be executed within a folder in packages folder.
../../node_modules/.bin/c8 -r html -r text node --test --test-reporter=cleaner-spec-reporter --test-concurrency=1 --test-timeout=2000000