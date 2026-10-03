from pydantic import BaseModel, ConfigDict, Field


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    description: str


class RoleOut(BaseModel):
    id: int
    name: str
    permissions: list[str]


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    permissions: list[str] = []


class RolePermissionsUpdate(BaseModel):
    """The complete list of permission codes the role should have afterwards."""

    permissions: list[str]


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    full_name: str = Field(default="", max_length=100)
    password: str = Field(min_length=6, max_length=200)
    role_id: int


class UserUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    full_name: str | None = Field(default=None, max_length=100)
    password: str | None = Field(default=None, min_length=6, max_length=200)
    role_id: int | None = None
    is_active: bool | None = None
