# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.

MooMoo.io uses the socket.io protocol.

## ID System

### For Players

Each player have two ID's that's the same throughout the connection:
* Short ID (SID, ID), which is an int
* Long ID (LID), which is a hashed string, provided by socket.io

## Server-Bound 

### `1` - Spawn
Spawn in the server, nothing special
* `data` - The information to spawn with
  * `data.name` - The name you chose
  * `data.skin` - The skin color

### `2` - Aim
Aim and point your weapon or tool at the angle you wish
* `angle` - The angle to aim at in radians

### `3` - Move
Move toward a direction
* `angle` - The angle to move toward in radians, null if not moving

### `8` - Alliance
Creates a new alliance.
* `name` - The name of the new alliance

### `ch` - Chat Message
Send a message that will appear over your player
* `message` - The message to send

## Client-bound

### `5` - Leaderboard
Leaderboard packets have the ID of `5`

### `ch` - Chat Message
Recieves a new message that will appear over the sender's player
* `id` - The sender's short ID
* `message` - The message that was sent