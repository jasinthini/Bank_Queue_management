from pydantic import BaseModel, ConfigDict, Field


class ServiceCreate(BaseModel):
    branch_id: int
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=20)
    token_prefix: str = Field(default="A", min_length=1, max_length=5)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    token_prefix: str | None = Field(default=None, min_length=1, max_length=5)


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    name: str
    code: str
    token_prefix: str