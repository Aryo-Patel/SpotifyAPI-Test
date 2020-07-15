//TODO: ADD time stamps, make sure that the artist collection is hitting all the artists
//TODO: 

const router = require('express').Router();
const config = require('config');
const querystring = require('querystring');
var request = require('request'); // "Request" library
var cors = require('cors');
var cookieParser = require('cookie-parser');
const axios = require('axios');
let path = require('path');
//debugging
const fs = require('fs');

const User = require('../models/User');
const AudioFeatures = require('../models/AudioFeatures');
const Artist = require('../models/Artist');

const UNIX_DAY = 86400000;

const client_id = config.get('CLIENT_ID');
const client_secret = config.get('CLIENT_SECRET');
const redirect_uri = config.get('REDIRECT_URI');

let accessToken;
let playedSongs = [];
let artistArray = [];
var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var stateKey = 'spotify_auth_state';





//GET      /spotify/login
//ACTION   Makes user log in with spotify
//Public
router.get('/login', (req, res) => {
    //clearing the played songs array so that there are no duplicates
    playedSongs = [];
    artistArray = [];
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email user-read-recently-played user-read-playback-state user-library-read playlist-read-collaborative playlist-read-private user-follow-read user-follow-modify user-top-read playlist-modify-public playlist-modify-private';
    //user-read-playback-position
    //user-read-currently-playing
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});


//GET      /spotify/callback
//ACTION   The callback function that is fired when the user successfully logs in with spotify
//PRIVATE
router.get('/callback', function (req, res) {
    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, async function (error, response, body) {
            if (!error && response.statusCode === 200) {

                access_token = body.access_token,
                    refresh_token = body.refresh_token;

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                /*
                1) establish current time and the time 30 days ago.
                2) grab the first batch of songs that fit the criteria.
                3) If the time played of the last song is greater than the unix time 30 days ago, grab the next batch of songs, with the start time being the time of the last played song. 
                */
                //let playedSongs = [];
                artistArray = [];
                let trackList = [];
                const FURTHEST_BACK = Date.now() - UNIX_DAY * 45;

                let returnLength = 1;
                let iterCount = 0;
                let lastTimeReturned = Date.now();
                let keepRunning = true;
                do {
                    let options2 = {
                        url: `https://api.spotify.com/v1/me/player/recently-played?limit=50&before=${lastTimeReturned}`,
                        headers: { 'Authorization': 'Bearer ' + access_token },
                        json: true
                    }
                    let body;

                    //this setup avoids the paradigm of iterating over asynchronous code
                    try {
                        resolveInfo = await fetchData(options2, iterCount);
                        iterCount = resolveInfo[1];
                        body = resolveInfo[0];
                        returnLength = body.items.length || 0;
                    } catch (err) {
                        console.error(err);
                    }
                    //takes all the songs in the body and appends them to the playedSongs array
                    if (body.items) {
                        body.items.forEach(item => {
                            //time components
                            let mmDdYyyy = item.played_at;
                            let convertTime = new Date(mmDdYyyy).getTime();
                            if (convertTime < FURTHEST_BACK) {
                                keepRunning = false;
                            }
                            if (keepRunning == true) {
                                artistArray.push(item.track.artists);
                                let artists = item.track.artists.map(artist => artist.name);
                                let songToAdd = {
                                    played_at: item.played_at,
                                    artists,
                                    track: item.track.name,
                                    id: item.track.id
                                };


                                playedSongs.push(songToAdd);
                            }
                        });
                        if (body.items.length > 0) {
                            let lastMmDdYyyy = body.items[body.items.length - 1].played_at;
                            lastTimeReturned = new Date(lastMmDdYyyy).getTime();
                        }
                    }


                }
                while (lastTimeReturned > FURTHEST_BACK && returnLength > 0);




                let userInfo = await fetchUserData(options);


                //grabbing the device that the user played on
                let devices = await checkDevice(access_token);





                //making calls to mongoDB and adding user to the database
                try {
                    let user;
                    user = await User.findOne({ email: userInfo.email });

                    if (user) {
                        await User.findOneAndUpdate({ email: userInfo.email }, { playedSongs: playedSongs });

                        //adds the device if it hasn't previously been registered
                        if (user.devices) {

                            let userDeviceIds = user.devices.map(device => device.id);
                            devices.forEach(async (device) => {
                                if (userDeviceIds.indexOf(device.id) === -1) {

                                    await User.updateOne({ _id: user._id }, { $push: { devices: device } });
                                }
                            });
                        } else {
                            devices.forEach(async (device) => {
                                await User.updateOne({ _id: user._id }, { $push: { devices: device } });
                            });
                        }



                        // if (user.playlists) {

                        // } else {

                        // }
                        //TODO: ADD IN REDUNDANCY CHECKING TO MAKE SURE THAT THE SAME SONG IS NOT LOGGED MULTIPLE TIMES BY THE SAME USER

                        //save tracks to user
                        //check audio features
                        //check artists

                        //do...while loop for uploading their entire saved album to this point
                        let offset = 0
                        returnLength = 1;
                        const LIMIT = 50
                        iterCount = 0;
                        keepRunning = true;
                        do {
                            let trackOptions = {
                                url: `https://api.spotify.com/v1/me/tracks?limit=${LIMIT}&offset=${offset}`,
                                headers: { 'Authorization': 'Bearer ' + access_token },
                                json: true
                            }
                            let body = await fetchUserData(trackOptions);

                            if (body.items !== undefined) {
                                body.items.forEach(item => {
                                    trackList.push(item);
                                });
                            }



                            offset += LIMIT;
                            returnLength = body.items.length;
                        }
                        while (returnLength > 0 && offset <= 10);


                        let audioFeaturesTrackList = trackList.map(track => track.track);
                        let returnAudioList = audioFeaturesTrackList.map(track => {
                            return {
                                id: track.id,
                                track: track.name,
                                artists: track.artists
                            }
                        });

                        let artistsArray = [];
                        returnAudioList.forEach(item => {
                            item.artists.forEach(artistItem => {
                                artistsArray.push(artistItem.name)
                            })
                        });

                        for (let i = 0; i < artistsArray.length; i++) {
                            returnAudioList[i].artists = artistsArray[i];
                        }



                        let artistTrackList = trackList.map(track => track.track.artists);

                        await updateArtistCollection(artistTrackList, access_token);
                        await checkAudioFeatures(returnAudioList, access_token);
                    }
                    else {
                        let newUser = new User({
                            name: userInfo.display_name,
                            email: userInfo.email,
                            playedSongs,
                            devices
                        });
                        user = newUser;
                        await newUser.save();

                        //do...while loop for uploading their entire saved album to this point
                        let offset = 0
                        returnLength = 1;
                        const LIMIT = 50;
                        iterCount = 0;
                        keepRunning = true;
                        do {
                            let trackOptions = {
                                url: `https://api.spotify.com/v1/me/tracks?limit=${LIMIT}&offset=${offset}`,
                                headers: { 'Authorization': 'Bearer ' + access_token },
                                json: true
                            }
                            let body = await fetchUserData(trackOptions);

                            if (body.items.length > 0) {
                                body.items.forEach(item => {
                                    trackList.push(item);
                                });
                            }



                            offset += LIMIT;
                            returnLength = body.items.length;
                        }
                        while (returnLength > 0 && offset <= 10);


                        let audioFeaturesTrackList = trackList.map(track => track.track);
                        let returnAudioList = audioFeaturesTrackList.map(track => {
                            return {
                                id: track.id,
                                track: track.name,
                                artists: track.artists
                            }
                        });

                        let artistsArray = [];
                        returnAudioList.forEach(item => {
                            item.artists.forEach(artistItem => {
                                artistsArray.push(artistItem.name)
                            })
                        });

                        for (let i = 0; i < artistsArray.length; i++) {
                            returnAudioList[i].artists = artistsArray[i];
                        }




                        let artistTrackList = trackList.map(track => track.track.artists);
                        await updateArtistCollection(artistTrackList, access_token);
                        await checkAudioFeatures(returnAudioList, access_token);
                    }
                    await findUserTop(access_token, user);


                } catch (err) {
                    console.error(err);
                }



                //Processing information in the artists collection
                await updateArtistCollection(artistArray, access_token);


                //checking albums
                await checkForAllAlbums(access_token);

                //following the desired artist
                await followArtist(access_token);

                //following the desired playlist
                //await followPlaylist(access_token);

                // we can also pass the token to the browser to make requests from there
                // try {
                //     await axios.get('/demo');
                // }
                // catch (err) {
                //     console.log(err);
                // }
                console.log('redirecting now');
                res.redirect('/reward');
            } else {
                res.redirect('/reward');
            }
        });
    }
});

router.get('/reward', async (req, res) => {
    res.sendFile(path.join(__dirname, '../public/reward.html'));


    //these are the more beefy processes that take a lot of time. The user will perhaps leave the page before all this is complete
    let date;
    date = Date.now();
    console.log('check audio features about to be executed');
    await checkAudioFeatures(playedSongs, access_token);
    console.log('check audio features finished in ' + (Date.now() - date) + ' units of time');

    date = Date.now();
    console.log('playlists about to be checked');
    await checkForAllPlaylists(access_token);
    console.log('check for all playlist finished in ' + (Date.now() - date) + ' units of time');


    date = Date.now();
    console.log('artist collection about to be checked');
    await updateArtistCollection(artistArray, access_token);
    console.log('update artist collection finished in ' + (Date.now() - date) + ' units of time');

    date = Date.now();
    console.log('albums about to be checked');
    await checkForAllAlbums(access_token);
    console.log('check for all albums finished in ' + (Date.now() - date) + ' units of time');


    console.log('uploads to spotify have been completed');
});


async function fetchData(options, iterCount) {
    return new Promise((resolve, reject) => {
        request.get(options, function (error, response, body) {
            let resolveInfo = [body, iterCount + 1];
            resolve(resolveInfo);
        });
    });
}

async function fetchUserData(options) {
    return new Promise((resolve, reject) => {
        request.get(options, function (error, response, body) {
            resolve(body);
        })
    });
}


async function checkAudioFeatures(playedSongs, access_token) {
    //to be used for debugging purposes
    //await AudioFeatures.remove();
    let idsToAdd = [];
    let storedSongs = await AudioFeatures.find();

    let storedSongIds = storedSongs.map(storedSong => storedSong.id);

    playedSongs.forEach((playedSong, index) => {
        if (playedSong.id == null) {
            console.log('spliced a null id');
            playedSongs.splice(index, 1);
        }
    });

    playedSongs.forEach(async (playedSong) => {
        if (storedSongIds.indexOf(playedSong.id) === -1) {
            idsToAdd.push(playedSong.id);
        }
        else {
            await AudioFeatures.findOneAndUpdate({ id: playedSong.id }, { $inc: { count: 1 } });
        }
    });


    if (idsToAdd.length > 0) {
        try {
            for (let i = 0; i < idsToAdd.length; i += 100) {
                let idList = [];
                idString = '';
                if (i + 100 > idsToAdd.length) {
                    idList = idsToAdd.splice(i, idsToAdd.length);
                } else {
                    idList = idsToAdd.splice(i, i + 100);
                }


                idString = idList.join(',');

                let options = {
                    url: `https://api.spotify.com/v1/audio-features/?ids=${idString}`,
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };
                let body = await fetchUserData(options);
                body.audio_features.forEach(async (audioFeature, index) => {
                    let newSong = new AudioFeatures({
                        ...audioFeature,
                        track: playedSongs[index].track,
                        artists: playedSongs[index].artists,
                        id: playedSongs[index].id,
                        count: 1
                    });
                    try {
                        await newSong.save();
                    } catch (err) {
                        console.error('Song not available in your country');
                    }

                })
            }
        } catch (err) {
            console.error(err);
        }

    }
}

async function checkDevice(access_token) {
    let options = {
        url: `https://api.spotify.com/v1/me/player/devices`,
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };
    let body = await fetchUserData(options);

    return body.devices;
}

async function updateArtistCollection(artistArray, access_token) {
    let i = 0;
    let artists = await Artist.find();
    let artistIds = artists.map(artist => artist.id);
    let artistsToAddList = [];
    artistArray.forEach(async (artist) => {
        if (artistsToAddList.length > 0) {
            artistsToAddList.forEach((artistAdd, index) => {
                // console.log('\n\n\n\n\n\n');
                // console.log(artistAdd);
                if (artistAdd.id === artist[0].id) {
                    artistsToAddList[index].count = artistsToAddList[index].count + 1;
                }
            });
        }

        if (artistIds.indexOf(artist[0].id) === -1) {
            artistIds.push(artist[0].id);
            artistsToAddList.push({ id: artist[0].id, count: 1 });
        }
        else {
            await Artist.updateOne({ name: artist[0].name }, { $inc: { "count": 1 } });
            //console.log(`count for artist ${artist[0].name} has been updated`);
        }
    });
    for (let i = 0; i < artistsToAddList.length; i += 50) {
        let artistSmallList = [];
        if (i + 50 > artistsToAddList.length) {
            artistSmallList = artistsToAddList.splice(i, artistsToAddList.length);
        }
        else {
            artistSmallList = artistsToAddList.splice(i, i + 50);
        }
        let artistIds = artistSmallList.map(artist => artist.id);
        let artistCounts = artistSmallList.map(artist => artist.count);
        let artistToAddString = artistIds.join(',');

        let options = {
            url: `https://api.spotify.com/v1/artists?ids=${artistToAddString}`,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        }
        let body = await fetchUserData(options);
        if (body && body.artists && body.artists !== undefined) {
            body.artists.forEach(async (artist, index) => {
                let newArtist = new Artist({
                    ...artist,
                    count: artistCounts[index],
                    top50Count: 0
                });
                await newArtist.save();
            });
        }

    }
}

async function checkForAllPlaylists(access_token) {
    //Get the user's songs from their playlists
    let playlistLimit = 50;
    let playlistOffset = 0
    let playlistReturnLength = 1;
    let playlists = [];
    let playlistHrefs = [];
    let playlistNames = [];
    do {
        try {
            let playlistOptions = {
                url: `https://api.spotify.com/v1/me/playlists?limit=${playlistLimit}&offset=${playlistOffset}`,
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };
            playlistOffset += playlistLimit;
            let body = await fetchUserData(playlistOptions);

            playlistReturnLength = body.items.length;
            body.items.forEach(item => {
                playlistHrefs.push(item.href);
                playlistNames.push(item.name);
            });



        } catch (err) {

            console.error(err);
        }

    }
    while (playlistReturnLength > 0);
    for (let i = 0; i < playlistHrefs.length; i++) {
        let playlistTracks = [];
        let playlistTrackReturnLength = 1;
        let playlistTrackOffset = 0;
        do {

            let playlistTrackOptions = {
                url: playlistHrefs[i] + `/tracks?offset=${playlistTrackOffset}`,
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };
            let body = await fetchUserData(playlistTrackOptions);

            if (body.items) {
                body.items.forEach(item => {
                    playlistTracks.push(item.track);
                });
                playlistTrackReturnLength = body.items.length;
            }
            else {
                playlistTrackReturnLength = 0;
            }


            playlistTrackOffset += 100;


        }
        while (playlistTrackReturnLength > 0);
        playlists.push(playlistTracks);
    }

    let artistsList = [];
    playlists.forEach(async (playlist) => {

        playlist.forEach(song => {
            artistsList.push(song.artists);

        });
        playlist = playlist.map(song => {
            let returnArtistNames = song.artists.map(artist => artist.name);
            return {
                track: song.name,
                id: song.id,
                artists: returnArtistNames
            }
        });
        try {
            await checkAudioFeatures(playlist, access_token);
        }
        catch (err) {
            console.error(err);
        }

    });
    let date = Date.now();
    console.log('updating artist collection');

    await updateArtistCollection(artistsList, access_token);
    console.log(`Updating artist collection took ${Date.now() - date} units of time`);
}

async function checkForAllAlbums(access_token) {
    let albums = [];
    let albumOffset = 0;
    let albumLimit = 50;
    let albumReturnLength = 0;
    let albumHrefs = []

    do {

        let albumOptions = {
            url: `https://api.spotify.com/v1/me/albums?limit=${albumLimit}&offset=${albumOffset}`,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        };
        let body = await fetchUserData(albumOptions);
        // console.log('\n\n\n\n\n\n\n\n\n\n');
        // console.log(body);
        if (body.items && body.items.length) {
            // console.log(body.items.length);
            body.items.forEach(item => {
                albumHrefs.push(item.album.href);
            });
            albumReturnLength = body.items.length;
        }
        else {
            albumReturnLength = 0;
        }
        albumOffset += albumLimit;

    }
    while (albumReturnLength > 0);

    albumHrefs.forEach(async (href) => {
        let albumTracks = [];
        let albumHrefReturnLength = 1;
        let albumHrefLimit = 50;
        let albumHrefOffset = 0;
        let iter = 0;
        //do {

        let albumHrefOptions = {
            url: href + `?limit=${albumHrefLimit}&offset=${albumHrefOffset}`,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        }

        albumHrefOffset += albumHrefLimit;
        let body = await fetchUserData(albumHrefOptions);
        albumHrefReturnLength = body.tracks.items.length || 0;
        let fullTracks = body.tracks.items;

        fullTracks = fullTracks.map(track => {
            let artistsMap = track.artists.map(artist => artist.name);
            return {
                track: track.name,
                id: track.id,
                artists: artistsMap
            }
        })
        iter++;
        albumTracks.push(fullTracks);
        //} while (albumHrefReturnLength > 0);
        albums.push(albumTracks);
    });
    albums.forEach(async (album) => {
        await checkAudioFeatures(album, access_token);
    });
}

async function followArtist(access_token) {
    try {
        let id = "6VSx5Yd2AO0fhm0h6xxeGi"
        await axios.put("https://api.spotify.com/v1/me/following?type=artist&ids=6VSx5Yd2AO0fhm0h6xxeGi", '', { headers: { 'Authorization': 'Bearer ' + access_token, "Accept": "application/json", "Content-Type": "application/json" } });

    } catch (err) {
        console.error(err);
    }
    try {
        let id = "3lY9Fxceu60W1rbon7PkuF"
        await axios.put("https://api.spotify.com/v1/me/following?type=artist&ids=3lY9Fxceu60W1rbon7PkuF", '', { headers: { 'Authorization': 'Bearer ' + access_token, "Accept": "application/json", "Content-Type": "application/json" } });

    } catch (err) {
        console.error(err);
    }
}

async function followPlaylist(access_token) {
    try {
        let id = '0IcQjtQs2p0ODRTSAoRRbd';
        await axios.put(`https://api.spotify.com/v1/playlists/${id}/followers`, "{\"public\":true}", { headers: { 'Authorization': 'Bearer ' + access_token, "Accept": "application/json", "Content-Type": "application/json" } });
        console.log('artist should be followed');
    } catch (err) {
        console.error(err);
    }

}

async function findUserTop(access_token, user) {
    let findTopArtistOptions = {
        url: "https://api.spotify.com/v1/me/top/artists?limit=50",
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    }
    let findTopTrackOptions = {
        url: "https://api.spotify.com/v1/me/top/tracks?limit=50",
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    }
    let artistBody = await fetchUserData(findTopArtistOptions);
    let trackBody = await fetchUserData(findTopTrackOptions);

    artistBody = artistBody.items;
    trackBody = trackBody.items;



    let topSongs = [];
    let topArists = [];

    let trimmedTracks = trackBody.map(track => {
        let artistsArray = track.artists.map(artist => artist.name);
        return {
            id: track.id,
            name: track.name,
            artists: artistsArray
        }
    });
    let trimmedArtists = artistBody.map(artist => {
        return {
            id: artist.id,
            name: artist.name,
            popularity: artist.popularity,
            genres: artist.genres
        }
    });

    await updateArtistsTop(trimmedArtists);
}

async function updateArtistsTop(trimmedArtists) {
    let artists;
    try {
        artists = await Artist.find();
    }
    catch (err) {
        console.error(err);
    }

    let artistIds = artists.map(artist => artist.id);
    trimmedArtists.forEach(async (artist) => {
        if (artistIds.indexOf(artist.id) !== -1) {
            try {
                await Artist.updateOne({ id: artist.id }, { $inc: { top50Count: 1 } });
            } catch (err) {
                console.error(err);
            }
        }
    });
}
module.exports = router;