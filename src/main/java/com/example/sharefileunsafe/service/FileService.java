package com.example.sharefileunsafe.service;

import com.example.sharefileunsafe.config.StorageProperties;
import com.example.sharefileunsafe.util.PathUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class FileService {
    private final Path root;

    public FileService(StorageProperties properties) {
        this.root = Paths.get(properties.getRoot()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create storage root: " + root, e);
        }
    }

    public Path getRoot() {
        return root;
    }

    public Path resolve(String path) {
        return PathUtils.resolveUnderRoot(root, path);
    }

    public List<Path> list(String dirPath) throws IOException {
        Path dir = resolve(dirPath);
        if (!Files.exists(dir)) {
            throw new NoSuchFileException("Not found: " + dir);
        }
        if (!Files.isDirectory(dir)) {
            throw new IllegalArgumentException("Path is not a directory: " + dir);
        }
        try (Stream<Path> s = Files.list(dir)) {
            // 按目录优先、名称排序
            return s.sorted(Comparator
                    .comparing((Path p) -> !isDirectoryQuiet(p))
                    .thenComparing(p -> p.getFileName().toString().toLowerCase()))
                    .collect(Collectors.toList());
        }
    }

    public Path upload(String targetDirPath, MultipartFile file) {
        return upload(targetDirPath, file, null);
    }

    public Path upload(String targetDirPath, MultipartFile file, String relativePath) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        Path dir = resolve(targetDirPath);
        if (!Files.exists(dir)) {
            throw new IllegalArgumentException("Target directory not exists: " + dir);
        }
        if (!Files.isDirectory(dir)) {
            throw new IllegalArgumentException("Target path is not a directory: " + dir);
        }
        String rp = relativePath;
        if (rp == null || rp.trim().isEmpty()) {
            rp = file.getOriginalFilename();
        }
        rp = rp.replace('\\', '/');
        Path target = dir.resolve(rp).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Target path escapes root");
        }
        try {
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file: " + target, e);
        }
        return target;
    }

    public InputStream openRead(String path) {
        Path p = resolve(path);
        if (!Files.exists(p) || !Files.isRegularFile(p)) {
            throw new IllegalArgumentException("File not found: " + p);
        }
        try {
            return Files.newInputStream(p, StandardOpenOption.READ);
        } catch (IOException e) {
            throw new RuntimeException("Failed to open file: " + p, e);
        }
    }

    public Path mkdir(String parentPath, String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Folder name is empty");
        }
        Path parent = resolve(parentPath);
        if (!Files.exists(parent) || !Files.isDirectory(parent)) {
            throw new IllegalArgumentException("Parent is not a directory: " + parent);
        }
        Path dir = parent.resolve(name).normalize();
        if (!dir.startsWith(root)) {
            throw new IllegalArgumentException("Folder path escapes root");
        }
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create folder: " + dir, e);
        }
        return dir;
    }

    public Path rename(String path, String newName) {
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("New name is empty");
        }
        Path src = resolve(path);
        if (!Files.exists(src)) {
            throw new IllegalArgumentException("Source not found: " + src);
        }
        Path target = src.getParent().resolve(newName).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Target path escapes root");
        }
        try {
            Files.move(src, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to rename: " + src + " -> " + target, e);
        }
        return target;
    }

    public Path move(String sourcePath, String targetDirPath) {
        Path src = resolve(sourcePath);
        Path targetDir = resolve(targetDirPath);
        if (!Files.exists(src)) {
            throw new IllegalArgumentException("Source not found: " + src);
        }
        if (!Files.exists(targetDir) || !Files.isDirectory(targetDir)) {
            throw new IllegalArgumentException("Target directory invalid: " + targetDir);
        }
        Path target = targetDir.resolve(src.getFileName()).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Target path escapes root");
        }
        try {
            Files.move(src, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to move: " + src + " -> " + target, e);
        }
        return target;
    }

    public boolean delete(String path) {
        Path p = resolve(path);
        if (!Files.exists(p)) return false;
        try {
            if (Files.isDirectory(p)) {
                // 递归删除目录及其内容
                try (Stream<Path> walk = Files.walk(p)) {
                    walk.sorted(Comparator.reverseOrder()).forEach(pp -> {
                        try {
                            Files.deleteIfExists(pp);
                        } catch (IOException e) {
                            throw new RuntimeException("Failed to delete: " + pp, e);
                        }
                    });
                }
                return !Files.exists(p);
            } else {
                return Files.deleteIfExists(p);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to delete: " + p, e);
        }
    }

    private boolean isDirectoryQuiet(Path p) {
        try {
            return Files.isDirectory(p);
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * 将给定的路径（文件或目录）压缩为Zip并写入输出流。
     * 目录会以其自身名称作为Zip中的顶层目录。
     */
    public void zipPaths(List<String> paths, OutputStream out) {
        Objects.requireNonNull(paths, "paths");
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            for (String pathStr : paths) {
                Path p = resolve(pathStr);
                if (!Files.exists(p)) {
                    // 跳过不存在的路径
                    continue;
                }
                if (Files.isDirectory(p)) {
                    String top = p.getFileName() != null ? p.getFileName().toString() : p.toString();
                    // 遍历目录并写入条目（跳过根本身的重复目录条目）
                    try (Stream<Path> walk = Files.walk(p)) {
                        walk.forEach(pp -> {
                            String rel = p.relativize(pp).toString().replace('\\', '/');
                            String entryName = top + (rel.isEmpty() ? "" : "/" + rel);
                            try {
                                if (Files.isDirectory(pp)) {
                                    // 为目录写入占位条目
                                    String dirName = entryName.endsWith("/") ? entryName : (entryName + "/");
                                    zos.putNextEntry(new ZipEntry(dirName));
                                    zos.closeEntry();
                                } else {
                                    // 写入文件内容
                                    zos.putNextEntry(new ZipEntry(entryName));
                                    byte[] buf = new byte[8192];
                                    try (InputStream in = Files.newInputStream(pp, StandardOpenOption.READ)) {
                                        int len;
                                        while ((len = in.read(buf)) > 0) {
                                            zos.write(buf, 0, len);
                                        }
                                    }
                                    zos.closeEntry();
                                }
                            } catch (IOException e) {
                                throw new RuntimeException("Failed to zip entry: " + pp, e);
                            }
                        });
                    }
                } else {
                    String entryName = p.getFileName() != null ? p.getFileName().toString() : p.toString();
                    try {
                        zos.putNextEntry(new ZipEntry(entryName));
                        byte[] buf = new byte[8192];
                        try (InputStream in = Files.newInputStream(p, StandardOpenOption.READ)) {
                            int len;
                            while ((len = in.read(buf)) > 0) {
                                zos.write(buf, 0, len);
                            }
                        }
                        zos.closeEntry();
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to zip file: " + p, e);
                    }
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to create zip", e);
        }
    }
}