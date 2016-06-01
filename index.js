var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var clients = {};
var clientNum = 0;
var players = [];

var mouseX = 0;
var mouseY = 0;
var slope = 0;

var killCounterString = "";
var tempKillCounter = 0;
var killCounterArray = [];

const FRAMES_PER_SECOND = 60;

const SHIP_SPEED = 10;
const TANK_ROTATION_SPEED = Math.PI * -.01;
const BULLET_SPEED = 20;

const hitRadius = 20;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.use(express.static('public'));

http.listen(3000, function(){
  console.log('listening on *:3000');
});

Array.prototype.clean = function(deleteValue) {
	for (var i = 0; i < this.length; i++) {
		if (this[i] == deleteValue) {
			this.splice(i, 1);
			i--;
		}
	}
	return this;
};

function makePlayer(startX, startY, startRotation, mySocketId, color) {
	var isLeftPressed = false;
	var isRightPressed = false;
	var isUpPressed = false;
	var isDownPressed = false
	var isSpacePressed = false
	var player = {
		x:startX,
		y:startY,
		username:"",
		windowWidth:0,
		windowHeight:0, 
		color:color,
		imgWidth:0,
		imgHeight:0,
		timeBetweenBullets:0,
		killCounter:0,
		rotation:startRotation,
		socket_id:mySocketId,
		bullets:[],
		keypresses:[isLeftPressed, isRightPressed, isUpPressed, isDownPressed, isSpacePressed],
		rotate:function(rotateLeft) { //rotateLeft is a boolean. If it's true, then the tank will rotate left, otherwise right
			this.rotation += (rotateLeft ? TANK_ROTATION_SPEED : -TANK_ROTATION_SPEED)
		},
		makeBullet: function(x, y, playerX, playerY, mouseX, mouseY, slope) {
			var bullet = {
				x:x,
				y:y,
				playerX:playerX,
				playerY:playerY,
				mouseX:mouseX,
				mouseY:mouseY,
				slope:slope,
				rotation:player.rotation,
				time: 0
			}
			this.bullets.push(bullet);
		}
	}
	players.push(player);
}

function getPlayerById(current_socket_id){
	for(var i = 0; i < players.length; i++){
		if(typeof players[i] !== 'undefined'){
			if(players[i].socket_id === current_socket_id){
				return i;
			}
		}
	}
	//throw "This person: '" + current_socket_id + "' does not have a ship!"
}

function updateFrame(){
	killCounterString = "";
	for (playerIter = 0; playerIter < players.length; playerIter++) {
		if ((players.length == 1) && (typeof players[playerIter] !== 'undefined')) {
			io.sockets.emit('game_over', "It's over.");
		}
		if(typeof players[playerIter] !== 'undefined'){
			// Increment timer between bullet fires
			players[playerIter].timeBetweenBullets++;

			if (players[playerIter].keypresses.isUpPressed) {
				players[playerIter].y -= SHIP_SPEED;
			}
			if (players[playerIter].keypresses.isDownPressed) {
				players[playerIter].y += SHIP_SPEED;
			}
			if (players[playerIter].keypresses.isLeftPressed) {
				players[playerIter].x += SHIP_SPEED;
			}
			if (players[playerIter].keypresses.isRightPressed) {
				players[playerIter].x -= SHIP_SPEED;
			}
			if (players[playerIter].keypresses.isSpacePressed) {
				if (players[playerIter].timeBetweenBullets > FRAMES_PER_SECOND/4) {
					slope = ((players[playerIter].windowHeight/2) - mouseY)/((players[playerIter].windowWidth/2) - mouseX);
					players[playerIter].makeBullet(players[playerIter].x, players[playerIter].y, players[playerIter].x, players[playerIter].y, mouseX, mouseY, slope);
					players[playerIter].timeBetweenBullets = 0;
				}
			}
			if (typeof players[playerIter] !== 'undefined') {
				for (var i = 0; i < players[playerIter].bullets.length; i++) {
					players[playerIter].bullets[i].time++
					if (players[playerIter].bullets[i].time > FRAMES_PER_SECOND*4) {
						delete players[playerIter].bullets[i];
					} else {
						if (players[playerIter].bullets[i].mouseX <= players[playerIter].windowWidth/2) {
							players[playerIter].bullets[i].x -= (Math.cos(Math.atan(players[playerIter].bullets[i].slope)) * BULLET_SPEED);
							players[playerIter].bullets[i].y -= (Math.sin(Math.atan(players[playerIter].bullets[i].slope)) * BULLET_SPEED);
						} else {
							players[playerIter].bullets[i].x += (Math.cos(Math.atan(players[playerIter].bullets[i].slope)) * BULLET_SPEED);
							players[playerIter].bullets[i].y += (Math.sin(Math.atan(players[playerIter].bullets[i].slope)) * BULLET_SPEED);
						}
						// Collision detection
						for (var j = 0; j < players.length; j++) {
							if ((typeof players[j] !== 'undefined') && (typeof players[playerIter].bullets[i] !== 'undefined') && (typeof players[j] !== 'undefined') && (players[playerIter].bullets[i].x > players[j].x - hitRadius) && (players[playerIter].bullets[i].x <= players[j].x + hitRadius) && (players[playerIter].bullets[i].y > players[j].y - hitRadius) && (players[playerIter].bullets[i].y <= players[j].y + hitRadius) && (j != playerIter)) {
								console.log('Player ' + playerIter + ' hit Player ' + j + '!');
								io.sockets.connected[players[playerIter].socket_id].emit('killConfirmed', 'Kill confirmed.');
								players[playerIter].killCounter++;
								delete players[j];
								delete players[playerIter].bullets[i];
							}
						}
					}
				}
			}
			players[playerIter].bullets.clean(undefined);
			killCounterArray[playerIter] = players[playerIter].killCounter;
			if ((playerIter == 0) && (players.length > 1)) {
				killCounterString += "" + players[playerIter].username + ": " + players[playerIter].killCounter + ", ";
			} else {
				killCounterString += "" + players[playerIter].username + ": " + players[playerIter].killCounter;
			}
		}
		players.clean(undefined);
	}

	var game_data = {
		players: players,
		killCounterString: killCounterString
	};
	io.sockets.emit('all_data', game_data);
}

io.on('connection', function(socket){
	var current_socket_id = socket.id;
	console.log("a user connected: " + current_socket_id);

	io.sockets.emit('connected', "Someone connected.");

	var myColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16);

	makePlayer(50, 50, 0, socket.id, myColor);

	socket.on('disconnect', function(){
    	console.log('user disconnected: ' + current_socket_id);
    	delete players[getPlayerById(current_socket_id)];
	});

	socket.on('username', function(username) {
		var index = getPlayerById(current_socket_id);
		players[index].username = username;
		console.log("username: " + username);
	});

	socket.on('user_input_state', function(data){
		try {
			//if(typeof players[index] !== 'undefined'){
			var index = getPlayerById(current_socket_id);
			io.sockets.connected[current_socket_id].emit('yourIndex', index);
			players[index].keypresses.isLeftPressed = data[0];
			players[index].keypresses.isRightPressed = data[1];
			players[index].keypresses.isUpPressed = data[2];
			players[index].keypresses.isDownPressed = data[3];
			players[index].keypresses.isSpacePressed = data[4];
			mouseX = data[5];
			mouseY = data[6];
			players[index].windowWidth = data[7];
			players[index].windowHeight = data[8];
			players[index].rotation = data[9];
			players[index].imgWidth = data[10];
			players[index].imgHeight = data[11];
		} catch (e) {
			console.log(e);
		}
	});
});

setInterval(function(){updateFrame();}, 1000/FRAMES_PER_SECOND);































