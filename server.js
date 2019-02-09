// server.js
// where your node app starts

// init project
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
//app.use(express.static('public'));
//var router = express.Router();
var router = express.Router();



var guidRegex = /^X\'[0-9a-fA-F]{32}\'$/;
var maxScoreRegex = /^[0-9]{1,9}$/;
// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the database datafiles');
});
var topTenGladiatorsQuery = fs.readFileSync("./.data/top_ten_gladiator_scores.sql", "utf8", );


// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(function(){
  if (!exists) {
    console.log("Something has happened to the database");
  }
  else {
    let sql = `PRAGMA foreign_keys = ON;`;
    _runSqlOnDb(sql);
    console.log('Game Collection Library Leaderboard Database is ready to go!');
    
  }
});

// middleware to use for all requests
router.use(function(req, res, next) {
    // do logging
    console.log("In router middleware");
    console.log(req.body);
    db.all(topTenGladiatorsQuery, function(err, rows) {
      console.log(JSON.stringify(rows));
    });
    next(); // make sure we go to the next routes and don't stop here
});

router.route('/player')
  .post(function(req, res) {
     // Validate that the post contains the required request parameter
    let playerID = req.body.player_id;
    let playerName = req.body.player_name;
    if (playerID && playerName) {
      console.log(`Checking for ${playerID}`);
    } else {
      res.status(404);
      return res.json({ message: `Did not find a player_id in the body`});
    }
  
  // Validate that the value of the request is a valid GUID
  if (guidRegex.test(playerID)) {
    let sql = `SELECT * FROM player_id
              WHERE player_id LIKE ${_makeSqlLikeString(playerID)}`;
    // Query for an existing user
    db.get(sql, (err, row) => {
      if (err) {
        console.error(err.message);
      }
      setTimeout(function() {
        if ( row ) {
          // The id exists, so update the name
          sql = `UPDATE player_id
                  SET name = ${playerName}
                  WHERE player_id LIKE ${_makeSqlLikeString(playerID)}`;
          console.log(sql);
          db.run(sql, function(err) {
            if (err) {
              console.error(err.message);
              res.status(400).json({ message: "An error occurred" }); 
            }
              console.log(`Ran sql: ${sql}`);
              console.log(`Changes: ${this.changes}`);
              res.status(200).json({ message: `Updated ${playerID} as ${playerName}`});
          });

        } else {
            // The id is new, so create the player
            sql = `INSERT INTO player_id(player_id, name)
                    VALUES('${_escapeSingleQuoteString(playerID)}', ${playerName})`;
            console.log(sql);
            db.run(sql, function(err) {
              if (err) {
                console.error(err.message);
                res.status(400).json({ message: "An error occurred" }); 
              }
              console.log(`Ran sql: ${sql}`);
              console.log(`Changes: ${this.changes}`);
              res.status(200).json({ message: `Created ${playerID} as ${playerName}`});
            });
        }
      }, 50);
    });
  } else {
    res.status(400).json({ message: `${playerID} is not formatted correctly`});
  }
})
.get(function(req, res) {
  let playerID = req.body.player_id;
  console.log(playerID);
  if ( !playerID ) {
    return res.status(400).json({ message: "An error occurred while looking up player name" });
  }
  // Validate that the value of the request is a valid GUID
  if (guidRegex.test(playerID)) {
    let sql = `SELECT * FROM player_id
              WHERE player_id LIKE ${_makeSqlLikeString(playerID)}`;
    // Query for an existing user
    db.get(sql, (err, row) => {
      if (err) {
        console.error(err.message);
      } else {
        res.status(200).json(row);
      }
    });
  } else {
    res.status(400).json({ message: "An error occurred while looking up player name" });
  }
  
});


router.route('/score')
  .post(function(req, res) {
    console.log("In the score post method");
    let gameID = req.body.game_id;
    let playerID = req.body.player_id;
    let score = req.body.score;
    let gameName;
    let insertedScore = false;
  
    if (guidRegex.test(gameID)) {
      db.each('SELECT * from game_id WHERE game_id LIKE ' + _makeSqlLikeString(gameID), function(err, row) {
        if ( row ) {
        
          gameName = row.name;
          if (guidRegex.test(playerID) && maxScoreRegex.test(score)) {
            console.log('time to insert: game_id - ' + gameID + ' player_id - ' + playerID + ' score - ' + score); 
            let sql = `INSERT INTO score_id (score, game_id, player_id)
                        VALUES ('${score}', '${_escapeSingleQuoteString(gameID)}', '${_escapeSingleQuoteString(playerID)}')`;
            console.log(sql);
            db.run(sql, function(err) {
              if (err) {
                console.error(err.message)
              } else {
                console.log(`Rows inserted ${this.changes}`);
                insertedScore = true;
              }
            });
          }
        } else if ( err ) {
          console.log(err);
        }
      });
    }
    // Give time for database read before response
    setTimeout(() => insertedScore ? res.status(200).json({ message: 'Successfully posted score for ' + gameName }) : res.status(400).json({ message: 'An error occured while posting the score.' }) , 20);
})
.get(function(req, res) {
  let errorMessage = "An error occurred while looking up scores";
  let gameID = req.body.game_id;
  if ( !gameID ) {
    return res.status(400).json({ message: errorMessage });
  }
  // Validate that the value of the request is a valid GUID
  if (guidRegex.test(gameID)) {
    let sql = 
    db.all(topTenGladiatorsQuery, function(err, rows) {
      if ( err ) {
        return res.status(404).json({ message: errorMessage });
      }
      res.status(200).json(rows);
    });
  } else {
    return res.status(400).json({ message: errorMessage });
  }
});

app.use('/api/v1', router);

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

function _makeSqlLikeString(stringValue) {
  return stringValue.replace("X'", "'%").replace(/'$/, "%'");
}

function _escapeSingleQuoteString(stringValue) {
 return stringValue.replace(/'/g, "''"); 
}

function insertSqlOnDB(sql) {
  db.run(sql, function(err) {
    if (err) {
      console.error(err.message)
      return -1;
    }
    console.log(`Rows inserted ${this.changes}`);
    return 0;
    });
}

function _runSqlOnDb(sql, res) {
      db.run(sql, function(err) {
        if (err) {
          console.error(err.message);
          return console.log(`An error occured while processing a command`); 
        }
        console.log(`Ran sql: ${sql}`);
        return console.log(`Changes: ${this.changes}`);
      });
}
