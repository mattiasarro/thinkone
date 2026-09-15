"""Object storage seam — S3 API (Cloudflare R2 / MinIO). Never store file bytes in Postgres."""

from __future__ import annotations

import asyncio
import hashlib
from typing import Protocol

from app.infra.settings import get_settings


class BlobStore(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> str: ...
    async def get(self, key: str) -> bytes: ...
    async def exists(self, key: str) -> bool: ...
    async def presigned_url(self, key: str, filename: str | None = None, expires: int = 600) -> str: ...


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class S3BlobStore:
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        s = get_settings()
        self.bucket = s.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=s.s3_endpoint,
            aws_access_key_id=s.s3_key,
            aws_secret_access_key=s.s3_secret,
            region_name=s.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self.bucket)
        except Exception:
            self._client.create_bucket(Bucket=self.bucket)

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        await asyncio.to_thread(self._client.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return key

    async def get(self, key: str) -> bytes:
        obj = await asyncio.to_thread(self._client.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(obj["Body"].read)

    async def exists(self, key: str) -> bool:
        try:
            await asyncio.to_thread(self._client.head_object, Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    async def presigned_url(self, key: str, filename: str | None = None, expires: int = 600) -> str:
        params = {"Bucket": self.bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = f'inline; filename="{filename}"'
        return await asyncio.to_thread(self._client.generate_presigned_url, "get_object", Params=params, ExpiresIn=expires)


class MemoryBlobStore:
    """Deterministic in-process store for tests."""

    def __init__(self) -> None:
        self.data: dict[str, tuple[bytes, str]] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        self.data[key] = (data, content_type)
        return key

    async def get(self, key: str) -> bytes:
        return self.data[key][0]

    async def exists(self, key: str) -> bool:
        return key in self.data

    async def presigned_url(self, key: str, filename: str | None = None, expires: int = 600) -> str:
        return f"memory://{key}"


_store: BlobStore | None = None


def blobstore() -> BlobStore:
    global _store
    if _store is None:
        s = get_settings()
        if s.app_env == "test" or not s.s3_endpoint:
            _store = MemoryBlobStore()
        else:
            st = S3BlobStore()
            st.ensure_bucket()
            _store = st
    return _store


def set_blobstore(store: BlobStore | None) -> None:
    global _store
    _store = store
