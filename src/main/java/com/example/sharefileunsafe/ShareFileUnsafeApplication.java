package com.example.sharefileunsafe;

import com.example.sharefileunsafe.config.StorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * @author wangyiping
 */
@SpringBootApplication
@EnableConfigurationProperties(StorageProperties.class)
public class ShareFileUnsafeApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShareFileUnsafeApplication.class, args);
    }
}