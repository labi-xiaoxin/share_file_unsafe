package com.example.sharefileunsafe.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "storage")
public class StorageProperties {
    /**
     * 根目录路径，仅允许在该目录下进行文件操作。
     */
    private String root = System.getProperty("user.home") + "/share-root";

    public String getRoot() {
        return root;
    }

    public void setRoot(String root) {
        this.root = root;
    }
}