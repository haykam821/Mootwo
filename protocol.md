# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.This

MooMoo.io uses the socket.io protocol.

## ID System

#### For Players

Each player have two ID's that's the same throughout the connection:

* Short ID (SID, ID), which is an int
* Long ID (LID), which is a hashed string, provided by socket.io

## Server-Bound 

### `8` - Alliance

Creates a new alliance.

* `name` - The name of the new alliance.
    
### `ch` - Chat Message

Send a message that will appear over your player.

* `message` - The message to send.

## Client-bound

### `5` - Leaderboard

Leaderboard packets have the ID of `5`

### `ch` - Chat Message

Recieves a new message that will appear over the sender's player.

* `id` - The sender's short ID.
* `message` - The message that was sent.
