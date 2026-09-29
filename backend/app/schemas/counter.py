from pydantic import BaseModel, ConfigDict, Field


class CounterCreate(BaseModel):
    branch_id: int
    service_id: int
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class CounterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class CounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    service_id: int
    name: str
    is_active: bool