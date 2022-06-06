// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2017, 2018, 2019 dbrock, rain, mrchico

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

// FIXME: This contract was altered compared to the production version.
// It doesn't use LibNote anymore.
// New deployments of this contract will need to include custom events (TO DO).

contract Dai {
  // --- Auth ---
  mapping(address => uint256) public wards;

  function rely(address guy) external auth {
    wards[guy] = 1;
  }

  function deny(address guy) external auth {
    wards[guy] = 0;
  }

  modifier auth() {
    require(wards[msg.sender] == 1, 'Dai/not-authorized');
    _;
  }

  // --- ERC20 Data ---
  string private constant name = 'Dai Stablecoin';
  string private constant symbol = 'DAI';
  string private constant version = '1';
  uint8 private constant decimals = 18;
  uint256 public totalSupply;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  mapping(address => uint256) public nonces;

  event Approval(address indexed src, address indexed guy, uint256 wad);
  event Transfer(address indexed src, address indexed dst, uint256 wad);

  // --- Math ---
  function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
    require((z = x + y) >= x);
  }

  function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
    require((z = x - y) <= x);
  }

  // --- EIP712 niceties ---
  bytes32 public DOMAIN_SEPARATOR;
  // bytes32 private constant PERMIT_TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
  bytes32 private constant PERMIT_TYPEHASH =
    0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;

  constructor(uint256 chainId_) {
    wards[msg.sender] = 1;
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256(
          'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
        ),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        chainId_,
        address(this)
      )
    );
  }

  // --- Token ---
  function transfer(address dst, uint256 wad) external returns (bool) {
    return transferFrom(msg.sender, dst, wad);
  }

  function transferFrom(
    address src,
    address dst,
    uint256 wad
  ) public returns (bool) {
    require(balanceOf[src] >= wad, 'Dai/insufficient-balance');
    if (src != msg.sender && allowance[src][msg.sender] < type(uint256).max) {
      require(allowance[src][msg.sender] >= wad, 'Dai/insufficient-allowance');
      allowance[src][msg.sender] = sub(allowance[src][msg.sender], wad);
    }
    balanceOf[src] = sub(balanceOf[src], wad);
    balanceOf[dst] = add(balanceOf[dst], wad);
    emit Transfer(src, dst, wad);
    return true;
  }

  function mint(address usr, uint256 wad) external auth {
    balanceOf[usr] = add(balanceOf[usr], wad);
    totalSupply = add(totalSupply, wad);
    emit Transfer(address(0), usr, wad);
  }

  function burn(address usr, uint256 wad) external {
    require(balanceOf[usr] >= wad, 'Dai/insufficient-balance');
    if (usr != msg.sender && allowance[usr][msg.sender] < type(uint256).max) {
      require(allowance[usr][msg.sender] >= wad, 'Dai/insufficient-allowance');
      allowance[usr][msg.sender] = sub(allowance[usr][msg.sender], wad);
    }
    balanceOf[usr] = sub(balanceOf[usr], wad);
    totalSupply = sub(totalSupply, wad);
    emit Transfer(usr, address(0), wad);
  }

  function approve(address usr, uint256 wad) external returns (bool) {
    allowance[msg.sender][usr] = wad;
    emit Approval(msg.sender, usr, wad);
    return true;
  }

  // --- Alias ---
  function push(address usr, uint256 wad) external {
    transferFrom(msg.sender, usr, wad);
  }

  function pull(address usr, uint256 wad) external {
    transferFrom(usr, msg.sender, wad);
  }

  function move(
    address src,
    address dst,
    uint256 wad
  ) external {
    transferFrom(src, dst, wad);
  }

  // --- Approve by signature ---
  function permit(
    address holder,
    address spender,
    uint256 nonce,
    uint256 expiry,
    bool allowed,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    bytes32 digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(PERMIT_TYPEHASH, holder, spender, nonce, expiry, allowed))
      )
    );

    require(holder != address(0), 'Dai/invalid-address-0');
    require(holder == ecrecover(digest, v, r, s), 'Dai/invalid-permit');
    require(expiry == 0 || block.timestamp <= expiry, 'Dai/permit-expired');
    require(nonce == nonces[holder]++, 'Dai/invalid-nonce');
    uint256 wad = allowed ? type(uint256).max : 0;
    allowance[holder][spender] = wad;
    emit Approval(holder, spender, wad);
  }
}
