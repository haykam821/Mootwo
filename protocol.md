# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io (s.io) protocol.MooMoo

## Server-Bound 

* `ch`
  * `message`
    * The message to send.

## Client-bound

* [Leaderboard (5)](#leaderboard)
* `ch`
  * `id`
    * The sender's short ID.
  * `message`
    * The message that was sent.

#### Leaderboard (5)

Leaderboard packets have the ID of `5`
