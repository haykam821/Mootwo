# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io (s.io) protocol.MooMoo

## Server-Bound 

### `8`

Creates a new alliance.

Arguments:
  * `name`
    * The name of the new alliance.
    
### `ch`

Send a message that will appear over your player.

Arguments:
  * `message`
    * The message to send.

## Client-bound

### `ch`

Recieves a new message that will appear over the sender's player.

Arguments:
  * `id`
    * The sender's short ID.
  * `message`
    * The message that was sent.
