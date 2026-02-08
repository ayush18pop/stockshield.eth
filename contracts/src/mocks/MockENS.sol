// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IENS {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32);
    function owner(bytes32 node) external view returns (address);
    function setResolver(bytes32 node, address resolver) external;
    function setTTL(bytes32 node, uint64 ttl) external;
    function resolver(bytes32 node) external view returns (address);
}

contract MockENS is IENS {
    mapping(bytes32 => address) private _owners;
    mapping(bytes32 => address) private _resolvers;
    mapping(bytes32 => uint64) private _ttls;

    event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner);
    event Transfer(bytes32 indexed node, address owner);
    event NewResolver(bytes32 indexed node, address resolver);
    event NewTTL(bytes32 indexed node, uint64 ttl);

    constructor(address _initialOwner) {
        _owners[bytes32(0)] = _initialOwner;
    }

    function setRecord(bytes32 node, address owner, address resolver, uint64 ttl) external {
        setOwner(node, owner);
        _setResolver(node, resolver);
        setTTL(node, ttl);
    }

    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external {
        bytes32 subnode = setSubnodeOwner(node, label, owner);
        _setResolver(subnode, resolver);
        setTTL(subnode, ttl);
    }

    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) public virtual override returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        _owners[subnode] = owner;
        emit NewOwner(node, label, owner);
        return subnode;
    }

    function setResolver(bytes32 node, address resolver) public virtual override {
        _setResolver(node, resolver);
    }

    function setTTL(bytes32 node, uint64 ttl) public virtual override {
        emit NewTTL(node, ttl);
        _ttls[node] = ttl;
    }
    
    function setOwner(bytes32 node, address owner) public virtual {
        emit Transfer(node, owner);
        _owners[node] = owner;
    }

    function owner(bytes32 node) public virtual override view returns (address) {
        return _owners[node];
    }

    function resolver(bytes32 node) public virtual override view returns (address) {
        return _resolvers[node];
    }

    function _setResolver(bytes32 node, address resolver) internal {
        emit NewResolver(node, resolver);
        _resolvers[node] = resolver;
    }
}
