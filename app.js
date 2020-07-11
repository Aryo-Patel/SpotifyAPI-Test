//initializing express
const express = require('express');
const app = express();

//other dependencies that are needed
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('config');
const mongoose = require('mongoose');

const http = require('http');

//Spotify API requirements
const client_id = config.get('CLIENT_ID');
const client_secret = config.get('CLIENT_SECRET');
const redirect_uri = config.get('REDIRECT_URI');

//MongoDB files
const MONGO_URI = config.get('MONGO_URI_TEST');


//importing routers
const spotifyRouter = require('./routes/spotify');

//accepting JSON files
app.use(express.json());


const User = require('./models/User');
const AudioFeatures = require('./models/AudioFeatures');
const Artist = require('./models/Artist');

//port normalization
function normalizePort(val) {
    let port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}


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
app.get('/clearDB/:id', async (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
    if (req.params.id === 'Fuera2020R3537') {
        await AudioFeatures.remove();
        await User.remove();
        await Artist.remove();
        console.log('removed all the entires in DB');
    }
})



let server = http.createServer(app);

const PORT = process.env.PORT || 3000;
//listening on port 3000 temporarily
app.listen(PORT, () => {
    console.log('Listening on port ' + PORT);

});