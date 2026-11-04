#!/usr/bin/env bash
# Install as ~/bin/jq (no extension) in Git Bash, and make it executable:
#   cp windows/jq-wrapper.sh ~/bin/jq && chmod +x ~/bin/jq
# Native jq.exe writes CRLF to Git Bash pipes, which breaks scripts that compare
# its output (every plugin then looks missing). This runs the real jq.exe with
# -b so output is plain LF, for scripts as well as interactive use.
# Needs ~/bin ahead of jq.exe's folder on PATH (the managed .bashrc block does
# this for shells started from Git Bash). Remove the file to undo.
exec jq.exe -b "$@"
