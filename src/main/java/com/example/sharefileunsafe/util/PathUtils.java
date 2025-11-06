package com.example.sharefileunsafe.util;

import java.nio.file.Path;
import java.nio.file.Paths;

public final class PathUtils {
    private PathUtils() {}

    /**
     * 解析并规范化相对路径，确保位于根目录之内。
     * @param root 根目录
     * @param inputPath 传入路径（可为空或以/开头）
     * @return 规范化后的绝对路径
     */
    public static Path resolveUnderRoot(Path root, String inputPath) {
        String safe = (inputPath == null || inputPath.trim().isEmpty()) ? "/" : inputPath.trim();
        // 统一分隔符
        safe = safe.replace('\\', '/');
        // 去掉前缀的多个斜杠
        while (safe.startsWith("//")) {
            safe = safe.substring(1);
        }
        // 将传入路径视为相对于根目录
        Path candidate = root.resolve(safe.startsWith("/") ? safe.substring(1) : safe).normalize().toAbsolutePath();
        Path normalizedRoot = root.normalize().toAbsolutePath();
        if (!candidate.startsWith(normalizedRoot)) {
            throw new IllegalArgumentException("Path escapes storage root: " + inputPath);
        }
        return candidate;
    }
}