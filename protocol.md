# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io (s.io) protocol.MooMoo

## Server-Bound 

* `ch`
  * `message`
    * The message to send.

### Client-bound

* `ch`
  * `id`
    * The sender's short ID.
  * `message`
    * The message that was sent.
