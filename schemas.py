from __future__ import annotations

from typing import List, Optional
from datetime import date

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

class PropertyInput(BaseModel):
    """Raw property features accepted by the API.

    Latitude / longitude should be real-world decimal degrees
    (e.g. 34.05, -118.25), NOT the Zillow 1e6-scaled integers.
    The Zillow CSV stores them as e.g. 34052345; divide by 1e6 before sending.
    """

    # Required core fields
    taxamount: float = Field(..., description="Annual property tax amount ($)")
    taxvaluedollarcnt: float = Field(..., description="Total assessed tax value ($)")
    finishedsquarefeet12: Optional[float] = Field(
        None, description="Finished living area (sq ft)"
    )
    lotsizesquarefeet: Optional[float] = Field(None, description="Lot size (sq ft)")
    yearbuilt: Optional[float] = Field(None, description="Year property was built")
    latitude: float = Field(
        ..., description="Latitude in decimal degrees (e.g. 34.05)"
    )
    longitude: float = Field(
        ..., description="Longitude in decimal degrees (e.g. -118.25)"
    )
    transactiondate: date = Field(..., description="Transaction date (YYYY-MM-DD)")
    fips: int = Field(..., description="FIPS county code (6037, 6059, or 6111)")

    # Optional fields used in additional ratio features
    calculatedfinishedsquarefeet: Optional[float] = Field(
        None,
        description="Calculated finished area – falls back to finishedsquarefeet12",
    )
    structuretaxvaluedollarcnt: Optional[float] = Field(
        None, description="Assessed value of structure ($)"
    )
    landtaxvaluedollarcnt: Optional[float] = Field(
        None, description="Assessed value of land ($)"
    )
    fullbathcnt: Optional[float] = Field(None, description="Number of full bathrooms")
    threequarterbathnbr: Optional[float] = Field(
        None, description="Number of three-quarter bathrooms"
    )

    @field_validator("fips")
    @classmethod
    def validate_fips(cls, v: int) -> int:
        if v not in (6037, 6059, 6111):
            raise ValueError("fips must be one of 6037 (LA), 6059 (Orange), 6111 (Ventura)")
        return v


class BatchPropertyInput(BaseModel):
    properties: List[PropertyInput] = Field(..., min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    logerror: float = Field(..., description="Predicted log(Zestimate) - log(SalePrice)")
    ci_lower: float = Field(..., description="95% confidence interval lower bound")
    ci_upper: float = Field(..., description="95% confidence interval upper bound")
    interpretation: str = Field(
        ...,
        description="Human-readable interpretation of the prediction sign/magnitude",
    )


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    count: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str


class ModelInfoResponse(BaseModel):
    cv_rmse_scores: dict
    feature_count: int
    training_date: str
    base_models: List[str]
    meta_model: str
    ensemble_cv_rmse: float
