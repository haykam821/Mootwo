# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.

MooMoo.io uses the socket.io protocol.

## Table of Contents

* [ID System](#id-systems)
  * [For Players](#for-players)
* [Server-Bound](#server-bound)
  * [`1` - Spawn](#1---spawn)
  * [`2` - Aim](#2---aim)
  * [`3` - Move](#3---move)
  * [`8` - Create Alliance](#8---create-alliance)
  * [`ch` - Chat Message](#ch---chat-message)
* [Client-bound](#client-bound)

## ID Systems

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

### `8` - Create Alliance
Creates a new alliance.
* `name` - The name of the new alliance

### `ch` - Chat Message
Send a message that will appear over your player
* `message` - The message to send

## Client-Bound

### `id` - Identify
Identify packets are sent as soon as the connection is made
* `data` - The current state of the server
  * `data.teams` - Array of created clans
    * `clan` - Object for a clan
      * `clan.sid` - Name of the clan
      * `clan.owner` - The SID of the owner of this clan

### `1` - Spawned
Emitted when you spawn or respawn
* `id` - Your SID

### `5` - Leaderboard
Leaderboard packets have the ID of `5`

### `15` - Level & XP
Emmitted when you gain XP or level up
* `xp` - Current XP
* `maxXp` - The XP you need to have to level up.
* `level`<sup>[1](#foot-1)</sup> - Your current level

### `ch` - Chat Message
Recieves a new message that will appear over the sender's player
* `id` - The sender's short ID
* `message` - The message that was sent

- - - - - - - - - - - - - - - - - - - -

<a name="foot-1">1</a>: injectable of HTML
