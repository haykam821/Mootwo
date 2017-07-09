# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io protocol.

## ID System

#### For Players

Each player have two ID's that's the same throughout the connection:

* Short ID (SID, ID), which is an int
* Long ID (LID), which is a hashed string, provided by socket.io

## Server-Bound 

* `ch`
  * `message`
    * The message to send.

## Client-bound

* [Leaderboard (`5`)](#leaderboard) - data of the leaderboard
* [Chat Message (`ch`)](#)
  * `id`
    * The sender's short ID.
  * `message`
    * The message that was sent.

#### Leaderboard (5)

Leaderboard packets have the ID of `5`

