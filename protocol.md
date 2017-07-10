# Protocol

This document describes the protocol used by MooMoo.io, as of July 9th, 2017.

MooMoo.io uses the socket.io protocol.

## Table of Contents

* [Table of Contents](#table-of-contents)
* [ID System](#id-systems)
  * [For Players](#for-players)
  * [For Objects](#for-objects)
  * [For Clans](#for-clans)
* [Server-Bound](#server-bound)
  * [`1` - Spawn](#1---spawn)
  * [`2` - Aim](#2---aim)
  * [`3` - Move](#3---move)
  * [`8` - Create Clan](#8---create-clan)
  * [`10` - Join Clan](#8---join-clan)
  * [`ch` - Send Message](#ch---send-message)
* [Client-bound](#client-bound)
  * [`id` - Identify](#id---identify)
  * [`1` - Spawned](#1---spawned)
  * [`5` - Leaderboard](#5---leaderboard)
  * [`15` - Level & XP](#15---level--xp)
  * [`ch` - Chat Message](#ch---chat-message)

## ID Systems

### For Players

Each player have two ID's that's the same throughout the connection:
* Short ID (SID, ID), which is an int
* Long ID (LID), which is a hashed string, provided by socket.io

### For Objects

Each object have an ID

### For Clans

Clans do not have numbered ID, but rather uses it's name

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

### `8` - Create Clan
Creates a new clan or alliance
* `name` - The name of the new clan

### `10` - Join Clan
Join an existing clan or alliance
* `name` - The name of the clan to join

### `ch` - Send Message
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
Leaderboard packets have the ID of `5`, can be 30 elements long, and is made of strings and ints
* `data` - An array with length multiple of 3, with each 3 element being an chunk
  * `chunk` - A chunk of this array with length 3
    * `id` - The SID of this player
    * `name` - The name of this player
    * `gold` - The amount of gold this player have

### `15` - Level & XP
Emmitted when you gain XP or level up
* `xp`<sup>[2](#foot-2)</sup> - Current XP
* `maxXp`<sup>[2](#foot-2)</sup> - The XP you need to have to level up.
* `level`<sup>[2](#foot-2)</sup> - Your current level

### `ch` - Chat Message
Recieves a new message that will appear over the sender's player
* `id` - The sender's short ID
* `message` - The message that was sent

- - - - - - - - - - - - - - - - - - - -

<a name="foot-1">1</a>: injectable of HTML  
<a name="foot-2">2</a>: optional  
