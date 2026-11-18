package com.aquaflow.inventory.brand;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/** Đọc: nhân viên cửa hàng; thêm/sửa/xóa: chỉ chủ cửa hàng (xem SecurityConfig). */
@RestController
@RequestMapping("/api/v1/brands")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Brands")
public class BrandController {
    private final BrandService service;
    public BrandController(BrandService service) { this.service = service; }

    @GetMapping public List<BrandService.Brand> list() { return service.list(); }
    @GetMapping("/{id}") public BrandService.Brand get(@PathVariable long id) { return service.get(id); }

    @PostMapping
    public ResponseEntity<BrandService.Brand> create(@Valid @RequestBody BrandService.BrandRequest request) {
        var brand = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/brands/" + brand.id())).body(brand);
    }

    @PutMapping("/{id}")
    public BrandService.Brand update(@PathVariable long id, @Valid @RequestBody BrandService.BrandRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
