# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io (s.io) protocol.MooMoo

## Server-Bound 

* `8` — create new alliance
  * `name`
    * The name of the new alliance.
* `ch` — send message
  * `message`
    * The message to send.

### Client-bound

* `ch` — recieve message
  * `id`
    * The sender's short ID.
  * `message`
    * The message that was sent.
