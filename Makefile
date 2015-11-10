default: gen
VERSION := $(shell git describe --always --dirty --tags)
TOOLS := github.com/jteeuwen/go-bindata/go-bindata github.com/tinylib/msgp github.com/mitchellh/gox github.com/aktau/github-release

tools:
	go get ${TOOLS}

tools-update:
	go get -u -f ${TOOLS}

clean:
	rm -f cmd/pipeviz/pipeviz cmd/pipeviz/pipeviz.test
	rm -f cmd/pvutil/pvutil cmd/pvutil/pvutil.test
	rm -f cmd/pvproxy/pvproxy cmd/pvproxy/pvproxy.test

test: gen
	go test ./...

gen: tools
	go generate -x ./schema

install: gen
	go install -ldflags "-X main.version ${VERSION}" ./cmd/...

build-all: gen
	gox -verbose \
	-ldflags "-X main.version ${VERSION}" \
	-os="linux darwin freebsd" \
	-arch="amd64 386" \
	-output="dist/{{.OS}}-{{.Arch}}/{{.Dir}}" ./cmd/...

.PHONY: tools tools-update gen install clean build-all
