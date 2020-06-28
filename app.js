//initializing express
const express = require('express');
const app = express();

//other dependencies that are needed
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('config');
const mongoose = require('mongoose');

//Spotify API requirements
const client_id = config.get('CLIENT_ID');
const client_secret = config.get('CLIENT_SECRET');
const redirect_uri = config.get('REDIRECT_URI');

//MongoDB files
const MONGO_URI = config.get('MONGO_URI');


//importing routers
const spotifyRouter = require('./routes/spotify');

//accepting JSON files
app.use(express.json());


//mongoDB setup 
const mongoSetup = async () => {
    try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('connected to server');
    } catch (err) {
        console.log(err);
    }
}

mongoSetup();

app.use(express.static(__dirname + '/public')).use(cors()).use(cookieParser());
//Routes
app.use('/', spotifyRouter);

app.get('/reward', (req, res) => {
    res.sendFile(__dirname + '/public/reward.html');
});
//listening on port 3000 temporarily
app.listen(3000, () => {
    console.log('Listening on port 3000');

});