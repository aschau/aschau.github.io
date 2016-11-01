//Andrew Steven Chau 56951511
//Elaine Chieng 55852758
//Tiffany Lam 31174165
//Jessica Lim 49545398

//Setting the variables we are going to be using a lot
var COLS = 30, ROWS = 20;

var EMPTY = 0, SNAKE = 1, PICKUP = 2, SNAKE2 = 3;

var LEFT = 0, UP = 1, RIGHT = 2, DOWN = 3;

var KEY_LEFT = 37, KEY_UP = 38, KEY_RIGHT = 39, KEY_DOWN = 40;

var KEY_A = 65, KEY_W = 87, KEY_D = 68, KEY_S = 83;

var fps = 15;
var interval = 1000 / fps;
var now;
var then = Date.now();
var delta;

//running = true when game should be running, false when paused
var running = true;

//this client's id
var clientid;

//names of both clients
var id1;
var id2;

//le server
var Server;

//the game grid
var grid = 
{
	width: null,
	height: null,
	_grid: null,
	
	init: function(d, c, r)
	{
		this.width = c;
		this.height = r;
		
		this._grid = [];
		for (var x = 0; x < c; x++)
		{
			this._grid[x] = [];
			for (var y = 0; y < r; y++)
			{
				this._grid[x].push(d);
			}
		}
	},
	
	set: function(val, x, y)
	{
		this._grid[x][y] = val;
	},
	
	get: function(x, y)
	{
		return this._grid[x][y];
	}
}

//snek 1 = player 1 = clientid 0
var snake = 
{
    direction: null,
    pdirection: null,
	last: null,
	_queue: null,
	
	init: function(d, x, y)
	{
		this.direction = d;
		this._queue = [];
		this.insert(x, y);
	},
	
	insert: function(x, y)
	{
		this._queue.unshift({x:x, y:y});
		this.last = this._queue[0];
	},
	
	remove: function()
	{
		return this._queue.pop();
	}
}

//snek2 = player 2 = clientid 1
var snake2 = 
{
    direction: null,
    pdirection: null,
	last: null,
	_queue: null,
	
	init: function(d, x, y)
	{
		this.direction = d;
		this._queue = [];
		this.insert(x, y);
	},
	
	insert: function(x, y)
	{
		this._queue.unshift({x:x, y:y});
		this.last = this._queue[0];
	},
	
	remove: function()
	{
		return this._queue.pop();
	}
}

//called when pressing start round button
function start()
{
	//sends reset to other player
	Server.send('message', "Reset");
	//disables start round button
	document.getElementById("startBtn").disabled = true;
	running = true;
	init();
	loop();
}

//player 2 sets the initial pickup after joining
//player 2 is the one sending because we dont want player 1 to send a pickup message before player 2 joins
function setinitialPickup()
{	
	if (clientid == "1")
	{
		// console.log(clientid);
		var empty = [];
		for (var x = 0; x < grid.width; x++)
		{
			for (var y = 0; y < grid.height; y++)
			{
				if (grid.get(x, y) == EMPTY)
				{
					empty.push({x:x, y:y});
				}
			}
		}
		
		var randpos = empty[Math.floor(Math.random()*empty.length)];
		Server.send("message", "Initial Pickup: " + randpos.x +", " + randpos.y)
		grid.set(PICKUP, randpos.x, randpos.y);
	}
}

//setting pickup when this client picks it up and sends that they got it to the other client
function setPickup(player)
{	
	// console.log(clientid);
	var empty = [];
	for (var x = 0; x < grid.width; x++)
	{
		for (var y = 0; y < grid.height; y++)
		{
			if (grid.get(x, y) == EMPTY)
			{
				empty.push({x:x, y:y});
			}
		}
	}
	
	var randpos = empty[Math.floor(Math.random()*empty.length)];
	Server.send("message", "Pickup: " + randpos.x +", " + randpos.y +": " + player)
	grid.set(PICKUP, randpos.x, randpos.y);
}

//canvas that we're drawing on
var canvas, ctx, keystate, frames;
canvas = document.createElement('canvas');

//main start function
function main()
{
	//setting canvas dimensions
	canvas.width = 600;
	canvas.height = 390;
	ctx = canvas.getContext('2d');
	document.body.appendChild(canvas);
	
	frames = 0;
	//checking for keys
	keystate = {};
	document.addEventListener("keydown", function(event){
		keystate[event.keyCode] = true;
	});
	
	document.addEventListener("keyup", function(event){
		delete keystate[event.keyCode];
	});

	//inital scores = 0
	p1wins = 0;
	p2wins = 0;
	ties = 0;
	
	init();
	var game = loop();
}

function init()
{
	//disable start button
	document.getElementById("startBtn").disabled = true;
	grid.init(EMPTY, COLS, ROWS);
	p1score = 0;
	p2score = 0;
	document.getElementById("p1score").innerHTML = "Player "+ id1 +" Score: " + p1score;
	document.getElementById("p2score").innerHTML = "Player "+ id2 +" Score: " + p2score;
	
	//setup inital snakes, originally separate before doing path extrapolation
	if (clientid == 0)
	{
		Server.send('message', document.getElementById("p1score").innerText);
		var sp = {x: Math.floor(COLS/3), y: ROWS-1};
		snake.init(UP, sp.x, sp.y);
		grid.set(SNAKE, sp.x, sp.y);
		//Server.send('message', "Snake 1: " + sp.x + ", " + sp.y + ": " + snake.direction + ": " + snake.last.x + ", " + snake.last.y)
		var sp2 = {x: Math.floor(COLS/1.5), y: ROWS-1};
		snake2.init(UP, sp2.x, sp2.y);
		grid.set(SNAKE2, sp2.x, sp2.y);
	}
	
	else
	{
		Server.send('message', document.getElementById("p2score").innerText);
		var sp2 = {x: Math.floor(COLS/1.5), y: ROWS-1};
		snake2.init(UP, sp2.x, sp2.y);
		grid.set(SNAKE2, sp2.x, sp2.y);
		//Server.send('message', "Snake 2: " + sp2.x + ", " + sp2.y + ": " + snake2.direction + ": " + snake2.last.x + ", " + snake2.last.y)
		var sp = {x: Math.floor(COLS/3), y: ROWS-1};
		snake.init(UP, sp.x, sp.y);
		grid.set(SNAKE, sp.x, sp.y);
	}

	setinitialPickup();
}

function loop()
{
	//loop the game while running = if not paused
	if (running)
	{
	    window.requestAnimationFrame(loop, canvas);

	    now = Date.now();
	    delta = now - then;
	    if (delta > interval)
	    {
	        update();
	        draw();

            then = now - (delta%interval)
	    }
	}
}

function update()
{
	document.getElementById("p1score").innerHTML = "Player "+ id1 +" Score: " + p1score;
    document.getElementById("p2score").innerHTML = "Player "+ id2 +" Score: " + p2score;
    document.getElementById("p1wins").innerHTML = "Player "+ id1 +" Wins: " + p1wins;
    document.getElementById("p2wins").innerHTML = "Player "+ id2 +" Wins: " + p2wins;
    document.getElementById("ties").innerHTML = "Ties: " + ties;

	frames++;
	
	//moves for client0
	if (clientid == 0)
	{
	    snake.pdirection = snake.direction;
		if (keystate[KEY_LEFT] && snake.direction !== RIGHT)
		{
			snake.direction = LEFT;
		}
		else if (keystate[KEY_UP] && snake.direction !== DOWN)
		{
			snake.direction = UP;
		}
		else if (keystate[KEY_RIGHT] && snake.direction !== LEFT)
		{
			snake.direction = RIGHT;
		}
		else if (keystate[KEY_DOWN] && snake.direction !== UP)
		{
			snake.direction = DOWN;
		}
	}
	
	//moves for client1
	else
	{
	    snake2.pdirection = snake2.direction;
		if (keystate[KEY_LEFT] && snake2.direction !== RIGHT)
		{
			snake2.direction = LEFT;
		}
		else if (keystate[KEY_UP] && snake2.direction !== DOWN)
		{
			snake2.direction = UP;
		}
		else if (keystate[KEY_RIGHT] && snake2.direction !== LEFT)
		{
			snake2.direction = RIGHT;
		}
		else if (keystate[KEY_DOWN] && snake2.direction !== UP)
		{
			snake2.direction = DOWN;
		}	
	}
	
	//if (frames%5 == 0)
	//{
		//client 0 only worries about snake 1 going out of bounds
		//this section also handles all snake movement
		if (clientid == 0)
		{
			var nx = snake.last.x;
			var ny = snake.last.y;
			
			switch(snake.direction)
			{
				case LEFT:
					nx--;
					break;
				case UP:
					ny--;
					break;
				case RIGHT:
					nx++;
					break;
				case DOWN:
					ny++;
					break;
			}
						
			//if either player dies, the one who dies loses 5 on their scores
			//this is to balance the game so that one player can't just get a pickup and kill themself to win
			if (nx < 0 || nx > grid.width-1 || ny < 0 || ny > grid.height-1 || grid.get(nx, ny) == SNAKE || grid.get(nx, ny) == SNAKE2)
			{
				p1score -= 5;

				//send whoever won, but don't update this clients wins right away in the case
				//that they both died around the same time. accounting for latency
				if (p1score > p2score)
				{
					// ++p1wins;
					//document.getElementById("p1wins").innerHTML = "Player "+ id1 +" Wins: " + p1wins;
					Server.send('message', "Player "+ id1 +" Wins: " + (p1wins+1));
				}
				
				else if (p2score > p1score)
				{
					// ++p2wins;
					//document.getElementById("p2wins").innerHTML = "Player "+ id2 +" Wins: " + p2wins;
					Server.send('message', "Player "+ id2 +" Wins: " + (p2wins+1));
				}
				
				else
				{
					// ++ties;
					//document.getElementById("ties").innerHTML = "Ties: " + ties;
					Server.send('message', "Ties: " + (ties+1));
				}
				
				//send pause to other client when dead and stop this client from running immediately
				//this is what causes the end states to be slightly different but does not affect actual gameplay
				Server.send('message', "Pause");
				document.getElementById("startBtn").disabled = false;
				running = false;
				return;
				// return init();
			}
			
			//if client runs over a pickup add to clients score and set new pickup
			//also send updated score to other client
			if (grid.get(nx, ny) == PICKUP)
			{
				++p1score;
				document.getElementById("p1score").innerHTML = "Player "+ id1 +" Score: " + p1score;
				Server.send('message', document.getElementById("p1score").innerText);
				var tail = {x:nx, y:ny};
				setPickup(SNAKE);
			}
			
			//otherwise just move the snake like normal
			else
			{
				var tail = snake.remove();
				grid.set(EMPTY, tail.x, tail.y);
				//Server.send('message', "Empty: " + tail.x + ", " + tail.y)
				tail.x = nx;
				tail.y = ny;
			}
			
		    //send new location to other client
			if (snake.direction != snake.pdirection)
			{
			    Server.send('message', "Snake 1 Tail: " + tail.x + ", " + tail.y + ": " + snake.direction + ": " + snake.last.x + ", " + snake.last.y);
			}
			grid.set(SNAKE, tail.x, tail.y);
			snake.insert(tail.x, tail.y);
			
			//send locations of all children in snake
			//for (var i = 0; i < snake._queue.length; i++)
			//{
            //    Server.send('message', "Snake 1 Child: " + snake._queue[i].x + ", " + snake._queue[i].y)
			//}
			
			//snake direction = null if extrapolation is at the edge, this way it doesnt try going 
			//out of the array, if it goes out of the array the game breaks
			//so if it tries to go out it stops moving until it receives the next message from client
			//that updates the other snakes direction
			//no need to check for anything other than movement because
			//only need to make it look like the other client is still moving
			//keeps client from teleporting around
			//this is basically how our extrapolation works/latency mitigation
			//for (var i = 0; i < snake2._queue.length; i++)
			//{
			//    grid.set(SNAKE2, snake2._queue[i].x, snake2._queue[i].y);
			//}

			var nx2 = snake2.last.x;
			var ny2 = snake2.last.y;
			
			switch(snake2.direction)
			{
				case LEFT:
					nx2--;
					break;
				case UP:
					ny2--;
					break;
				case RIGHT:
					nx2++;
					break;
				case DOWN:
					ny2++;
					break;
			}

			if (!(nx2 > grid.width-1 || ny2 > grid.height-1 || ny2 < 0 || nx2 < 0))
			{
				var tail2 = snake2.remove();
				grid.set(EMPTY, tail2.x, tail2.y);
				tail2.x = nx2;
				tail2.y = ny2;

				if (grid.get(nx2, ny2) == PICKUP)
				{
				    grid.set(PICKUP, nx2, ny2);
				}
				else
				{
				    grid.set(SNAKE2, tail2.x, tail2.y);
				}

				snake2.insert(tail2.x, tail2.y);
			}
		}
		
		else
		{
			var nx2 = snake2.last.x;
			var ny2 = snake2.last.y;
			
			switch(snake2.direction)
			{
				case LEFT:
					nx2--;
					break;
				case UP:
					ny2--;
					break;
				case RIGHT:
					nx2++;
					break;
				case DOWN:
					ny2++;
					break;
			}
			
			if (nx2 < 0 || nx2 > grid.width-1 || ny2 < 0 || ny2 > grid.height-1 || grid.get(nx2, ny2) == SNAKE2 || grid.get(nx2, ny2) == SNAKE)
			{
				p2score -= 5;
				
				if (p1score > p2score)
				{
					// ++p1wins;
					//document.getElementById("p1wins").innerHTML = "Player "+ id1 +" Wins: " + p1wins;
					Server.send('message', "Player "+ id1 +" Wins: " + (p1wins+1));
				}
				
				else if (p2score > p1score)
				{
					// ++p2wins;
					//document.getElementById("p2wins").innerHTML = "Player "+ id2 +" Wins: " + p2wins;
					Server.send('message', "Player "+ id2 +" Wins: " + (p2wins+1));
				}
				
				else
				{
					// ++ties;
					//document.getElementById("ties").innerHTML = "Ties: " + ties;
					Server.send('message', "Ties: " + (ties+1));
				}	
				
				Server.send('message', "Pause");
				document.getElementById("startBtn").disabled = false;
				running = false;
				return;
				// return init();
			}
			
			if (grid.get(nx2, ny2) == PICKUP)
			{
				++p2score;
				document.getElementById("p2score").innerHTML = "Player "+ id2 +" Score: " + p2score;
				Server.send('message', document.getElementById("p2score").innerText);
				var tail2 = {x:nx2, y:ny2};
				setPickup(SNAKE2);
			}
			else
			{
				var tail2 = snake2.remove();
				//Server.send('message', "Empty: " + tail2.x + ", " + tail2.y)
				grid.set(EMPTY, tail2.x, tail2.y);
				tail2.x = nx2;
				tail2.y = ny2;
			}
			
			if (snake2.direction != snake2.pdirection)
			{
			    Server.send('message', "Snake 2 Tail: " + tail2.x + ", " + tail2.y + ": " + snake2.direction + ": " + snake2.last.x + ", " + snake2.last.y);
			}
			grid.set(SNAKE2, tail2.x, tail2.y);
			snake2.insert(tail2.x, tail2.y);

			var nx = snake.last.x;
			var ny = snake.last.y;
				
			switch(snake.direction)
			{
				case LEFT:
					nx--;
					break;
				case UP:
					ny--;
					break;
				case RIGHT:
					nx++;
					break;
				case DOWN:
					ny++;
					break;
			}
				
			if (!(nx > grid.width-1 || ny > grid.height-1 || ny < 0 || nx < 0))
			{
			    var tail = snake.remove();
			    grid.set(EMPTY, tail.x, tail.y);
			    tail.x = nx;
			    tail.y = ny;
			    if (grid.get(nx, ny) == PICKUP)
			    {
			        grid.set(PICKUP, nx, ny);
			    }

			    else
			    {
			        grid.set(SNAKE, tail.x, tail.y);
			    }
			    snake.insert(tail.x, tail.y);
			}
		}
	//}
}

//draw da canvas
function draw()
{
	var tw = canvas.width/grid.width;
	var th = canvas.height/grid.height;
	
	for (var x = 0; x < grid.width; x++)
	{
		for (var y = 0; y < grid.height; y++)
		{
			switch (grid.get(x, y))
			{
				case EMPTY:
					ctx.fillStyle = "#d3d3d3";
					break;
				case SNAKE:
					ctx.fillStyle = "#0000FF";
					break;
					
				case PICKUP:
					ctx.fillStyle = "#00FF00";
					break;
				case SNAKE2:
					ctx.fillStyle = "#FF0000";
					break;
			}
			ctx.fillRect(x * tw, y * th, tw, th);
		}
	}
}
