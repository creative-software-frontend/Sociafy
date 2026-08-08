const newsfeedService = require("../services/newsfeedService");
const { handleError } = require("../utils/httpError");

async function getPosts(req, res) {
    try {
        const { page, limit } = req.query;
        const result = await newsfeedService.getPosts(req.user.id, page, limit);
        res.json(result);
    } catch (err) {
        return handleError(res, err);
    }
}

async function createPost(req, res) {
    try {
        const { content, image_url } = req.body || {};
        const post = await newsfeedService.createPost(req.user.id, content, image_url);
        res.status(201).json(post);
    } catch (err) {
        return handleError(res, err);
    }
}

async function deletePost(req, res) {
    try {
        const result = await newsfeedService.deletePost(req.user.id, req.params.id);
        res.json(result);
    } catch (err) {
        return handleError(res, err);
    }
}

async function toggleLike(req, res) {
    try {
        const result = await newsfeedService.toggleLike(req.user.id, req.params.id);
        res.json(result);
    } catch (err) {
        return handleError(res, err);
    }
}

async function getComments(req, res) {
    try {
        const { page, limit } = req.query;
        const result = await newsfeedService.getComments(req.params.id, page, limit);
        res.json(result);
    } catch (err) {
        return handleError(res, err);
    }
}

async function addComment(req, res) {
    try {
        const { content } = req.body;
        const comment = await newsfeedService.addComment(req.user.id, req.params.id, content);
        res.status(201).json(comment);
    } catch (err) {
        return handleError(res, err);
    }
}

async function sharePost(req, res) {
    try {
        const result = await newsfeedService.sharePost(req.user.id, req.params.id);
        res.json(result);
    } catch (err) {
        return handleError(res, err);
    }
}

module.exports = { getPosts, createPost, deletePost, toggleLike, getComments, addComment, sharePost };
