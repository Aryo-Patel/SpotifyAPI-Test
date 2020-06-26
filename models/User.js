const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    playedSongs: [{
        track: {
            type: String,
            required: true
        },
        artists: [String],
        id: {
            type: String,
            required: true
        }
    }],
    devices: [{
        id: {
            type: String
        },
        is_active: {
            type: Boolean
        },
        is_private_session: {
            type: Boolean
        },
        is_restricted: {
            type: Boolean
        },
        name: {
            type: String
        },
        type: {
            type: String
        },
        volume_percent: {
            type: Number
        }
    }]
})

const User = new mongoose.model("Users", UserSchema);

module.exports = User;