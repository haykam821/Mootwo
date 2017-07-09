//*
class Player {
  constructor(x, y, id, gold, wood, stone, food) {
    this.x = x;
    this.y = y;

    this.id = id;

    this.resources = [gold,wood,stone,food];
  }

  getResources(index) {
    return this.resources[index];
    console.log(this.resources)
  }

  addResources(index,count) {
    this.resources[index] += count;

    return this.resources[index];
  }
}

var limit = 14400;

var teams = [];
var sockets = [];

var players = [];

const repl = require('repl')
var io = require('socket.io')
for (var i = 5000; i <= 5010; i++) {
  io(i).on('connection', function (socket) {
    sockets.push(socket)
    socket.on('1', function(data){
      var id = players.length + 1;

      players.push(new Player(0, 0, id, 0, 100, 0, 0));

      name = data.name.length > 15 ? data.name : data.name;

      socket.emit('id', {"teams":teams})
      socket.emit('1', id)
      socket.emit('mm', 0)
      socket.emit('3', [])

      socket.emit("14", 0, 0);
      socket.emit("14", 1, 1);
      socket.emit("14", 2, 2);
      socket.emit("14", 3, 3);

      var x = Math.random() * limit
      var y = Math.random() * limit

      var userteam = null;
      var last = 0;

      var i = 0;

      while (i < 20) {
        var j = i;
        socket.on(i, function(){
          //console.log(j, arguments)
        });

        i++;
      }

      socket.on('4', function(a,b){
        //console.log('4:', arguments)
      });

      setInterval(() => {
        if (y >= 6840 && y <= 7560) {
          x += 0.44;

          socket.emit('id', {"teams":teams})

          socket.emit("3",[id,x,y,-2.26,-1,0,0,userteam,0,0,0,0])
          console.log(players[id])
          socket.emit("9","gold",players[id].getResources[0],1)
          socket.emit("9","wood",players[id].getResources[1],1)
          socket.emit("9","stone",players[id].getResources[2],1)
          socket.emit("9","food",players[id].getResources[3],1)
        }
    },)
      socket.emit("2",["a3Pm5dMzeKOjc5gvAJEF",id,name,x,7200,0,100,100,35,data.skin],true)
      socket.emit("5",[27,data.name,9001])//[5,"<b>RIP</b>",31988,45,"KADEJO503",23404,34,"winter wolf",4821,28,"Godenot",4500,33,"Arena Closer",3000,32,"LightTheif",2940,6,"CarlosKoS-_-16",2800,4,"GD desconhecido",2635,35,"jack black GD",2357,19,"AMIGO BOM",1623])
      socket.emit("6",[
        29, 3115.1, 13592.9, 0, 109.2, 1, null, -1,
        353,  4103, 13436,   0,    80, 2, null, -1,
        339,  2498, 14155,   0,    90, 2, null, -1])
      socket.emit("8",2.6,28)

      socket.on("ch",data=>{
        emit("ch", id, data)
      })

      socket.on("8", data => {
        console.log('CLAN CREATE REQUEST:', data);

        teams.push([{"sid":data,"owner":id}])
        var userteam = data;

        emit("st", data, true)
      });

      socket.on("3",function(data){
        if (data == null) {
          vx = vy = 0
          return
        } else if (x < 0 || x > limit || y < 0 || y > limit) {
          x = 7200;
          y = 7200;
        }

        var speed = y > 2400 ? 60 * 0.8 : 60;

        vx = Math.cos(data) * speed
        vy = Math.sin(data) * speed

        x += vx;
        y += vy;

        socket.emit('a')
        socket.emit("3",[id,x,y,-2.26,-1,0,0,null,0,0,0,0])
      })

      socket.on("14",function(data){
        console.log('ping!!!', arguments)
      })
    })

    var emit = (...arg) => {
      try {
        socket.broadcast.emit(...arg)
        socket.emit(...arg)
      } catch (e) {
        sockets.forEach(a => a.emit(...arg))
      }
    }
  });
}

var evalAsync = async function(um) {
  eval(um)
}
repl.start({
  eval: (a, _c, _f, cb) => evalAsync(a).then(b => cb(null, b)).catch(err => cb(err))
})

/*/

var proxy = require('socket.io-proxy');

var socket = proxy.connect('http://45.63.110.209/');

socket.on('connect', function () {
    console.log('Socket connected');
    socket.on('command', function (data) {
        console.log('Received data', data);
    });
    socket.on('id', function (data) {
        console.log(data);
    });
    socket.on('disconnect', function() {
        console.log('Socket disconnected');
    });
});//*/
