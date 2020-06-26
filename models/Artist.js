const mongoose = require('mongoose');

const Schmea = mongoose.Schema;


const ArtistSchmea = new Schmea({
    external_urls: {
        spotify: {
            type: String
        }
    },
    followers: {
        total: {
            type: Number
        }
    },
    genres: [String],
    href: {
        type: String
    },
    id: {
        type: String
    },
    images: [{
        height: {
            type: Number
        },
        url: {
            type: String
        },
        width: {
            type: Number
        }
    }],
    name: {
        type: String
    },
    popularity: {
        type: Number
    },
    type: {
        type: String
    },
    uri: {
        type: String
    },
    count: {
        type: Number,
        default: 1
    },
    top50Count: {
        type: Number,
        default: 0
    }
});

const Artist = new mongoose.model("Artists", ArtistSchmea);

module.exports = Artist;