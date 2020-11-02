methods {
	setBorrowing(address, uint256, bool) envfree
	setUsingAsCollateral(address, uint256, bool) envfree
	isUsingAsCollateralOrBorrowing(address, uint256) returns bool envfree
	isBorrowing(address, uint256) returns bool envfree
	isUsingAsCollateral(address, uint256) returns bool envfree
	isBorrowingAny(address ) returns bool envfree
 	isEmpty(address ) returns bool envfree
}

invariant empty(address user, uint256 reserveIndex ) 
	 isEmpty(user) => !isBorrowingAny(user) && !isUsingAsCollateralOrBorrowing(user, reserveIndex)

invariant notEmpty(address user, uint256 reserveIndex ) 
	( isBorrowingAny(user) ||  isUsingAsCollateral(user, reserveIndex)) => !isEmpty(user)


invariant borrowing(address user, uint256 reserveIndex ) 
	 isBorrowing(user, reserveIndex) =>  isBorrowingAny(user) 

invariant collateralOrBorrowing(address user, uint256 reserveIndex ) 
	( isUsingAsCollateral(user, reserveIndex) ||  isBorrowing(user, reserveIndex) ) <=>  isUsingAsCollateralOrBorrowing(user, reserveIndex) 



rule setBorrowing(address user, uint256 reserveIndex, bool borrowing)
{
	require reserveIndex < 128;
	
	setBorrowing(user, reserveIndex, borrowing);
	assert isBorrowing(user, reserveIndex) == borrowing, "unexpected result";
}

rule setBorrowingNoChangeToOther(address user, uint256 reserveIndex, uint256 reserveIndexOther, bool borrowing)
{
	require reserveIndexOther != reserveIndex;
	require reserveIndexOther < 128 && reserveIndex < 128;
	bool otherReserveBorrowing =  isBorrowing(user, reserveIndexOther);
	bool otherReserveCollateral = isUsingAsCollateral(user,reserveIndexOther);

	setBorrowing(user, reserveIndex, borrowing);
	assert otherReserveBorrowing == isBorrowing(user, reserveIndexOther) &&
		otherReserveCollateral == isUsingAsCollateral(user,reserveIndexOther), "changed to other reserve";
}


rule  setUsingAsCollateral(address user, uint256 reserveIndex, bool usingAsCollateral)
{
	require reserveIndex < 128;
	
	setUsingAsCollateral(user, reserveIndex, usingAsCollateral);
	assert isUsingAsCollateral(user, reserveIndex) == usingAsCollateral, "unexpected result";
}


rule setUsingAsCollateralNoChangeToOther(address user, uint256 reserveIndex, uint256 reserveIndexOther, bool usingAsCollateral)
{
	require reserveIndexOther != reserveIndex;
	require reserveIndexOther < 128 && reserveIndex < 128;
	bool otherReserveBorrowing = isBorrowing(user, reserveIndexOther);
	bool otherReserveCollateral = isUsingAsCollateral(user,reserveIndexOther);
	
	setUsingAsCollateral(user, reserveIndex, usingAsCollateral);
	assert otherReserveBorrowing == isBorrowing(user, reserveIndexOther) &&
		otherReserveCollateral == isUsingAsCollateral(user,reserveIndexOther), "changed to other reserve";
}
