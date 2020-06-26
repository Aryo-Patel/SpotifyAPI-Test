const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const AudioFeaturesSchema = new Schema({
    track: {
        type: String,
        required: true
    },
    artists: [String],
    count: {
        type: Number,
        required: true
    },
    id: {
        type: String,
        required: true
    },
    danceability: {
        type: Number

    },
    energy: {
        type: Number

    },
    key: {
        type: Number

    },
    loudness: {
        type: Number
    },
    mode: {
        type: Number
    },
    speechiness: {
        type: Number
    },
    acousticness: {
        type: Number
    },
    instrumentalness: {
        type: Number
    },
    liveness: {
        type: Number
    },
    valence: {
        type: Number
    },
    tempo: {
        type: Number
    },
    type: {
        type: String
    },
    uri: {
        type: String
    },
    track_href: {
        type: String
    },
    analysis_url: {
        type: String
    },
    duration: {
        type: Number
    },
    time_signature: {
        type: Number
    }
});

const AudioFeatures = new mongoose.model("Audio Features", AudioFeaturesSchema);
module.exports = AudioFeatures;