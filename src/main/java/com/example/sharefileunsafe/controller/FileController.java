package com.example.sharefileunsafe.controller;

import com.example.sharefileunsafe.model.DeleteResult;
import com.example.sharefileunsafe.model.FileInfo;
import com.example.sharefileunsafe.service.FileService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api")
public class FileController {
    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @GetMapping("/files")
    public List<FileInfo> list(@RequestParam(value = "path", required = false) String path) {
        try {
            List<Path> paths = fileService.list(path);
            return paths.stream().map(p -> {
                try {
                    boolean dir = Files.isDirectory(p);
                    long size = dir ? 0L : Files.size(p);
                    long last = Files.getLastModifiedTime(p).toMillis();
                    String rel = fileService.getRoot().relativize(p).toString().replace('\\', '/');
                    String name = p.getFileName() != null ? p.getFileName().toString() : rel;
                    return new FileInfo(name, "/" + rel, dir, size, last);
                } catch (IOException e) {
                    return new FileInfo(p.getFileName().toString(), p.toString(), Files.isDirectory(p), 0L, Instant.now().toEpochMilli());
                }
            }).collect(Collectors.toList());
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @GetMapping("/files/download")
    public void download(@RequestParam("path") String path, HttpServletResponse response) {
        try {
            Path p = fileService.resolve(path);
            if (!Files.exists(p) || !Files.isRegularFile(p)) {
                throw new IllegalArgumentException("File not found: " + p);
            }

            String filename = p.getFileName().toString();
            String contentType = Files.probeContentType(p);
            if (contentType == null) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            long size = Files.size(p);

            String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8.name()).replaceAll("\\+", "%20");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded);
            response.setContentType(contentType);
            response.setContentLengthLong(size);

            try (InputStream is = fileService.openRead(path)) {
                OutputStream os = response.getOutputStream();
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                }
                os.flush();
            } catch (IOException ioe) {
                if (isClientAbort(ioe)) {
                    log.debug("Client aborted download: {}", path);
                    return;
                }
                log.warn("Download IO failed: {}", path, ioe);
            }
        } catch (Exception e) {
            if (response.isCommitted()) {
                log.warn("Download failed after response committed: {}", path, e);
                return;
            }
            throw translate(e);
        }
    }

    @PostMapping(value = "/files/upload")
    public Map<String, Object> upload(@RequestParam("path") String path,
                                      @RequestParam("file") MultipartFile file,
                                      @RequestParam(value = "relativePath", required = false) String relativePath) {
        try {
            Path saved = fileService.upload(path, file, relativePath);
            Map<String, Object> res = new HashMap<>();
            res.put("path", "/" + fileService.getRoot().relativize(saved).toString().replace('\\', '/'));
            res.put("name", saved.getFileName().toString());
            return res;
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @PostMapping("/folders/create")
    public Map<String, Object> createFolder(@RequestParam("path") String path,
                                            @RequestParam("name") String name) {
        try {
            Path dir = fileService.mkdir(path, name);
            Map<String, Object> res = new HashMap<>();
            res.put("path", "/" + fileService.getRoot().relativize(dir).toString().replace('\\', '/'));
            res.put("name", dir.getFileName().toString());
            return res;
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @PostMapping("/files/rename")
    public Map<String, Object> rename(@RequestParam("path") String path,
                                      @RequestParam("newName") String newName) {
        try {
            Path target = fileService.rename(path, newName);
            Map<String, Object> res = new HashMap<>();
            res.put("path", "/" + fileService.getRoot().relativize(target).toString().replace('\\', '/'));
            res.put("name", target.getFileName().toString());
            return res;
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @PostMapping("/files/move")
    public Map<String, Object> move(@RequestParam("sourcePath") String sourcePath,
                                    @RequestParam("targetDir") String targetDir) {
        try {
            Path target = fileService.move(sourcePath, targetDir);
            Map<String, Object> res = new HashMap<>();
            res.put("path", "/" + fileService.getRoot().relativize(target).toString().replace('\\', '/'));
            res.put("name", target.getFileName().toString());
            return res;
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @DeleteMapping("/files")
    public Map<String, Object> delete(@RequestParam("path") String path) {
        try {
            boolean deleted = fileService.delete(path);
            Map<String, Object> res = new HashMap<>();
            res.put("deleted", deleted);
            return res;
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @PostMapping("/files/batch-delete")
    public List<DeleteResult> batchDelete(@RequestParam("paths") List<String> paths) {
        try {
            return paths.stream().map(p -> {
                try {
                    boolean ok = fileService.delete(p);
                    return new DeleteResult(p, ok, ok ? null : "未删除");
                } catch (Exception e) {
                    return new DeleteResult(p, false, e.getMessage());
                }
            }).collect(Collectors.toList());
        } catch (Exception e) {
            throw translate(e);
        }
    }

    @GetMapping("/files/batch-download")
    public void batchDownload(@RequestParam("paths") List<String> paths, HttpServletResponse response) {
        try {
            if (paths == null || paths.isEmpty()) {
                throw new IllegalArgumentException("No paths provided");
            }
            String filename = "download-" + Instant.now().toEpochMilli() + ".zip";
            String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8.name()).replaceAll("\\+", "%20");

            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded);
            response.setContentType("application/zip");

            try {
                fileService.zipPaths(paths, response.getOutputStream());
            } catch (IOException ioe) {
                if (isClientAbort(ioe)) {
                    log.debug("Client aborted batch download: {}", paths);
                    return;
                }
                log.warn("Batch download IO failed: {}", paths, ioe);
            }
        } catch (Exception e) {
            if (response.isCommitted()) {
                log.warn("Batch download failed after response committed: {}", paths, e);
                return;
            }
            throw translate(e);
        }
    }

    private boolean isClientAbort(Throwable t) {
        Throwable cur = t;
        while (cur != null) {
            String cn = cur.getClass().getName();
            if (cn.contains("ClientAbortException")) return true;
            String msg = cur.getMessage();
            if (msg != null) {
                if (msg.contains("Broken pipe") || msg.contains("Connection reset") || msg.contains("reset by peer")) {
                    return true;
                }
            }
            cur = cur.getCause();
        }
        return false;
    }

    private ResponseStatusException translate(Exception e) {
        if (e instanceof java.nio.file.NoSuchFileException) {
            return new ResponseStatusException(NOT_FOUND, e.getMessage(), e);
        }
        if (e instanceof IllegalArgumentException || e instanceof IllegalStateException) {
            return new ResponseStatusException(BAD_REQUEST, e.getMessage(), e);
        }
        return new ResponseStatusException(INTERNAL_SERVER_ERROR, e.getMessage(), e);
    }
}
