package com.example.sharefileunsafe.model;

import java.time.Instant;

public class FileInfo {
    private String name;
    private String path;
    private boolean directory;
    private long size;
    private long lastModified;

    public FileInfo() {}

    public FileInfo(String name, String path, boolean directory, long size, long lastModified) {
        this.name = name;
        this.path = path;
        this.directory = directory;
        this.size = size;
        this.lastModified = lastModified;
    }

    public static FileInfo of(String name, String path, boolean directory, long size, Instant lastModified) {
        return new FileInfo(name, path, directory, size, lastModified.toEpochMilli());
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public boolean isDirectory() {
        return directory;
    }

    public void setDirectory(boolean directory) {
        this.directory = directory;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }

    public long getLastModified() {
        return lastModified;
    }

    public void setLastModified(long lastModified) {
        this.lastModified = lastModified;
    }
}