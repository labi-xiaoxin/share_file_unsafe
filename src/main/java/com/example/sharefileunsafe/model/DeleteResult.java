package com.example.sharefileunsafe.model;

public class DeleteResult {
    private String path;
    private boolean deleted;
    private String error;

    public DeleteResult() {}

    public DeleteResult(String path, boolean deleted, String error) {
        this.path = path;
        this.deleted = deleted;
        this.error = error;
    }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}