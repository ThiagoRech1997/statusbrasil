# Buildx Bake configuration for StatusBrasil.
#
# Local single-arch (host platform):
#   docker buildx bake app
#
# Multi-arch (CI; requires registry push or QEMU + --load workaround):
#   docker buildx bake multiarch --push
#
# Inspect the resolved targets without building:
#   docker buildx bake --print

variable "REGISTRY" {
  default = "ghcr.io/thiagorech"
}

variable "IMAGE_NAME" {
  default = "statusbrasil"
}

variable "VERSION" {
  default = "dev"
}

group "default" {
  targets = ["app"]
}

target "app" {
  context    = "."
  dockerfile = "Dockerfile"
  tags = [
    "${IMAGE_NAME}:${VERSION}",
    "${REGISTRY}/${IMAGE_NAME}:${VERSION}",
  ]
}

target "multiarch" {
  inherits  = ["app"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = [
    "${REGISTRY}/${IMAGE_NAME}:${VERSION}",
    "${REGISTRY}/${IMAGE_NAME}:latest",
  ]
}
